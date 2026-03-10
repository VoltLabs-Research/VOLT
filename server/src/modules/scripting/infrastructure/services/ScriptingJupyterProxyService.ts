import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/team-member/TeamMember';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import { WebSocketServer, WebSocket } from 'ws';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { Request, Response } from 'express';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

interface ProxyPathMatch {
    teamId: string;
    runtimeNotebookId: string;
    proxiedPath: string;
};

interface AuthorizedProxyContext {
    teamId: string;
    runtimeNotebookId: string;
    teamClusterId: string;
};

interface DaemonNotebookRuntimeResponse {
    hostPort: number | null;
};

interface TeamMemberRolePopulate {
    path: 'role';
    select: ['permissions'];
};

const JUPYTER_PROXY_BASE_PATH = '/api/jupyter';
const ACCESS_TOKEN_QUERY_PARAM = 'access_token';
const ACCESS_TOKEN_COOKIE_NAME = 'voltScriptingJupyterAccessToken';
const UPGRADE_ACTION = Action.READ;

const METHOD_ACTION_MAP: Record<string, Action> = {
    'GET': Action.READ,
    'HEAD': Action.READ,
    'POST': Action.CREATE,
    'PUT': Action.UPDATE,
    'PATCH': Action.UPDATE,
    'DELETE': Action.DELETE
};

type UpgradeWebSocket = InstanceType<WebSocketServer['clients'] extends Set<infer T> ? new (...args: never[]) => T : never>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readCookies = (rawCookieHeader?: string): Record<string, string> => {
    if (!rawCookieHeader) {
        return {};
    }

    const cookies: Record<string, string> = {};
    for (const entry of rawCookieHeader.split(';')) {
        const [rawKey, ...rawValueParts] = entry.split('=');
        const key = rawKey?.trim();
        if (!key) {
            continue;
        }

        cookies[key] = decodeURIComponent(rawValueParts.join('=').trim());
    }

    return cookies;
};

const writeUpgradeError = (socket: Duplex, statusCode: number, message: string): void => {
    socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

@injectable()
export class ScriptingJupyterProxyService {
    private readonly webSocketServer = new WebSocketServer({
        noServer: true
    });

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,

        @inject(ScriptingJupyterAccessTokenService)
        private readonly accessTokenService: ScriptingJupyterAccessTokenService
    ) {}

    public proxyHttpRequest = async (req: Request, res: Response): Promise<void> => {
        try {
            const context = await this.authorizeHttpRequest(req);
            this.persistAccessTokenCookie(req, res, context);
            const body = this.readRequestBody(req.body);
            const headers = this.readProxyRequestHeaders(req);
            const response = await this.teamClusterDaemonClient.commandResponseStream(context.teamClusterId, 'notebook.proxy.http', {
                notebookId: context.runtimeNotebookId,
                ...this.buildDaemonProxyPayload(req.originalUrl, context),
                method: this.readRequestMethod(req.method),
                headers,
                body
            });

            this.prepareProxyResponse(res, response);
            response.stream.on('error', (error: Error) => {
                if (!res.headersSent) {
                    BaseResponse.fromError(res, ApplicationError.internalServerError(error.message));
                    return;
                }

                res.destroy(error);
            });
            response.stream.pipe(res);
        } catch (error: unknown) {
            BaseResponse.fromError(res, error);
        }
    };

    isJupyterUpgradeRequest(request: IncomingMessage): boolean {
        const requestPath = request.url || '';
        return requestPath.startsWith(JUPYTER_PROXY_BASE_PATH);
    }

    public handleUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
        if (!this.isJupyterUpgradeRequest(request)) {
            return;
        }

        try {
            const context = await this.authorizeUpgradeRequest(request);
            const runtime = await this.teamClusterDaemonClient.command<DaemonNotebookRuntimeResponse>(
                context.teamClusterId,
                'notebook.runtime.get',
                {
                    notebookId: context.runtimeNotebookId
                }
            );

            if (!runtime.hostPort) {
                throw ApplicationError.conflict('Scripting::JupyterUnavailable', 'Jupyter runtime is not available');
            }

            const targetUrl = this.buildDaemonWebSocketTargetUrl(request.url || '', context, runtime.hostPort);
            const reverseWebSocket = await this.teamClusterDaemonClient.attachWebSocket(context.teamClusterId, targetUrl);

            this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.bindWebSocketProxy(webSocket, reverseWebSocket);
            });
        } catch (error: unknown) {
            const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
            const message = error instanceof Error ? error.message : 'WebSocket upgrade failed';
            writeUpgradeError(socket, statusCode, message);
        }
    };

    private async authorizeHttpRequest(req: Request): Promise<AuthorizedProxyContext> {
        const context = await this.authorizeProxyAccess(
            req.originalUrl,
            this.readHeaderValue(req.headers.cookie),
            this.resolveAction(req.method)
        );

        return context;
    }

    private async authorizeUpgradeRequest(request: IncomingMessage): Promise<AuthorizedProxyContext> {
        return this.authorizeProxyAccess(request.url || '', this.readHeaderValue(request.headers.cookie), UPGRADE_ACTION);
    }

    private async authorizeProxyAccess(
        requestUrl: string,
        cookieHeader: string | undefined,
        action: Action
    ): Promise<AuthorizedProxyContext> {
        const match = this.matchProxyPath(requestUrl);
        if (!match) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Jupyter proxy route not found');
        }

        const url = new URL(requestUrl, 'http://volt.local');
        const cookieToken = readCookies(cookieHeader)[ACCESS_TOKEN_COOKIE_NAME];
        const accessToken = url.searchParams.get(ACCESS_TOKEN_QUERY_PARAM) || cookieToken;
        if (!accessToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        const verifiedToken = this.accessTokenService.verify(accessToken);
        if (!verifiedToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        }

        if (verifiedToken.teamId !== match.teamId || verifiedToken.runtimeNotebookId !== match.runtimeNotebookId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, ErrorCodes.TEAM_ACCESS_DENIED);
        }

        const member = await this.teamMemberRepository.findOne({
            user: verifiedToken.userId,
            team: match.teamId
        }, {
            populate: {
                path: 'role',
                select: ['permissions']
            } satisfies TeamMemberRolePopulate
        });

        if (!member) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN);
        }

        const permissions = getTeamMemberRolePermissions(member.props.role);
        const permission = `${Resource.SCRIPTING}:${action}`;
        if (!permissions.includes('*') && !permissions.includes(permission)) {
            throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, `Missing permission: ${permission}`);
        }

        const notebook = await this.scriptingNotebookRepository.findOne({
            team: match.teamId,
            runtimeNotebookId: match.runtimeNotebookId
        });

        if (!notebook || !notebook.props.teamCluster || !notebook.props.runtimeNotebookId) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook runtime not found');
        }

        return {
            teamId: match.teamId,
            runtimeNotebookId: match.runtimeNotebookId,
            teamClusterId: notebook.props.teamCluster
        };
    }

    private persistAccessTokenCookie(req: Request, res: Response, context: AuthorizedProxyContext): void {
        const accessToken = this.readAccessTokenFromUrl(req.originalUrl);
        if (!accessToken) {
            return;
        }

        res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: `${JUPYTER_PROXY_BASE_PATH}/${encodeURIComponent(context.teamId)}/notebooks/${encodeURIComponent(context.runtimeNotebookId)}`
        });
    }

    private bindWebSocketProxy(webSocket: WebSocket, reverseWebSocket: TeamClusterReverseWebSocketStream): void {
        reverseWebSocket.on('data', (payload) => {
            webSocket.send(payload.data, {
                binary: payload.isBinary
            });
        });
        reverseWebSocket.on('end', (payload) => {
            webSocket.close(payload.code || 1000, payload.message);
        });
        reverseWebSocket.on('error', () => {
            webSocket.close(1011, 'Remote Jupyter websocket failed');
        });

        webSocket.on('message', (data: Buffer, isBinary: boolean) => {
            const message = typeof data === 'string' ? data : Buffer.from(data);
            reverseWebSocket.send(message, isBinary);
        });
        webSocket.on('close', () => {
            reverseWebSocket.destroy();
        });
        webSocket.on('error', () => {
            reverseWebSocket.destroy();
        });
    }

    private buildDaemonProxyPayload(requestUrl: string, context: AuthorizedProxyContext): Record<string, unknown> {
        const url = new URL(requestUrl, 'http://volt.local');
        const proxyBasePath = `${JUPYTER_PROXY_BASE_PATH}/${encodeURIComponent(context.teamId)}/notebooks/${encodeURIComponent(context.runtimeNotebookId)}`;
        const proxiedPath = url.pathname.startsWith(proxyBasePath)
            ? url.pathname.slice(proxyBasePath.length) || '/'
            : '/';

        url.searchParams.delete(ACCESS_TOKEN_QUERY_PARAM);

        const search = url.searchParams.toString();
        return {
            proxiedPath,
            rawQuery: search ? `?${search}` : ''
        };
    }

    private buildDaemonWebSocketTargetUrl(requestUrl: string, context: AuthorizedProxyContext, hostPort: number): string {
        const url = new URL(requestUrl, 'http://volt.local');
        const proxyBasePath = `${JUPYTER_PROXY_BASE_PATH}/${encodeURIComponent(context.teamId)}/notebooks/${encodeURIComponent(context.runtimeNotebookId)}`;
        const proxiedPath = url.pathname.startsWith(proxyBasePath)
            ? url.pathname.slice(proxyBasePath.length) || '/'
            : '/';

        url.searchParams.delete(ACCESS_TOKEN_QUERY_PARAM);

        const search = url.searchParams.toString();
        return search
            ? `ws://127.0.0.1:${hostPort}${proxiedPath}?${search}`
            : `ws://127.0.0.1:${hostPort}${proxiedPath}`;
    }

    private prepareProxyResponse(res: Response, response: TeamClusterReverseChannelStreamAttachment): void {
        res.removeHeader('x-frame-options');
        res.removeHeader('content-security-policy');
        res.status(response.status);

        for (const [headerName, headerValue] of Object.entries(response.headers)) {
            const normalizedHeaderName = headerName.toLowerCase();
            if (normalizedHeaderName === 'transfer-encoding' || normalizedHeaderName === 'content-encoding') {
                continue;
            }

            if (normalizedHeaderName === 'x-frame-options' || normalizedHeaderName === 'content-security-policy') {
                continue;
            }

            res.setHeader(headerName, headerValue);
        }
    }

    private readProxyRequestHeaders(req: Request): Record<string, string> {
        const headers: Record<string, string> = {};

        for (const [headerName, headerValue] of Object.entries(req.headers)) {
            const normalizedHeaderName = headerName.toLowerCase();
            if (!headerValue || normalizedHeaderName === 'host' || normalizedHeaderName === 'content-length') {
                continue;
            }

            if (Array.isArray(headerValue)) {
                headers[headerName] = headerValue.join(', ');
                continue;
            }

            headers[headerName] = headerValue;
        }

        return headers;
    }

    private readRequestBody(body: unknown): Record<string, unknown> | undefined {
        if (!isRecord(body)) {
            return undefined;
        }

        return body;
    }

    private readRequestMethod(method: string): 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' {
        if (method === 'GET' || method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
            return method;
        }

        return 'GET';
    }

    private resolveAction(method: string): Action {
        return METHOD_ACTION_MAP[method] || Action.READ;
    }

    private matchProxyPath(requestUrl: string): ProxyPathMatch | null {
        const url = new URL(requestUrl, 'http://volt.local');
        const match = url.pathname.match(/^\/api\/jupyter\/([^/]+)\/notebooks\/([^/]+)(\/.*)?$/);
        if (!match) {
            return null;
        }

        return {
            teamId: decodeURIComponent(match[1]),
            runtimeNotebookId: decodeURIComponent(match[2]),
            proxiedPath: match[3] || '/'
        };
    }

    private readAccessTokenFromUrl(requestUrl: string): string | null {
        const url = new URL(requestUrl, 'http://volt.local');
        return url.searchParams.get(ACCESS_TOKEN_QUERY_PARAM);
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }
};
