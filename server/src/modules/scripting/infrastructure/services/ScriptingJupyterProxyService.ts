import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { ErrorCodes } from '@core/constants/error-codes';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/team-member/TeamMember';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import {
    TeamClusterServiceExposureAccessMode
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { TeamClusterDaemonNotebookRuntime } from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { Request, Response } from 'express';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import type { Duplex } from 'node:stream';
import type { RawData } from 'ws';

interface ProxyPathMatch {
    teamId: string;
    runtimeNotebookId: string;
};

interface AuthorizedProxyContext {
    teamId: string;
    runtimeNotebookId: string;
    teamClusterId: string;
};

interface TeamMemberRolePopulate {
    path: 'role';
    select: ['permissions'];
};

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
};

const JUPYTER_PROXY_BASE_PATH = '/api/jupyter';
const ACCESS_TOKEN_QUERY_PARAM = 'access_token';
const ACCESS_TOKEN_COOKIE_NAME = 'voltScriptingJupyterAccessToken';
const JUPYTER_NATIVE_TOKEN_QUERY_PARAM = 'token';
const UPGRADE_ACTION = Action.READ;
const PROXY_URL_ORIGIN = 'http://volt.local';
const UPSTREAM_URL_ORIGIN = 'http://upstream.local';
const JUPYTER_PROXY_TEMPORARY_UNAVAILABLE_MESSAGE = 'Jupyter proxy is temporarily unavailable';
const DAEMON_PROXY_UNAVAILABLE_ERROR_MESSAGES = [
    'team cluster daemon connection was lost',
    'team cluster daemon reverse channel is not connected',
    'team cluster daemon connection is not ready yet'
];

const METHOD_ACTION_MAP: Record<string, Action> = {
    'GET': Action.READ,
    'HEAD': Action.READ,
    'POST': Action.CREATE,
    'PUT': Action.UPDATE,
    'PATCH': Action.UPDATE,
    'DELETE': Action.DELETE
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeWebSocketPayload = (data: RawData): Buffer | string => {
    if (typeof data === 'string') {
        return data;
    }

    if (Buffer.isBuffer(data)) {
        return data;
    }

    if (Array.isArray(data)) {
        return Buffer.concat(data.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    }

    return Buffer.from(data);
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

const buildFrameAncestorsDirective = (): string => {
    const frameAncestors = new Set<string>(['\'self\'']);

    for (const origin of [process.env.CLIENT_HOST, process.env.CLIENT_DEV_HOST]) {
        if (origin?.trim()) {
            frameAncestors.add(origin.trim());
        }
    }

    return `frame-ancestors ${Array.from(frameAncestors).join(' ')}`;
};

const rewriteFrameAncestorsDirective = (contentSecurityPolicy?: string): string => {
    const frameAncestorsDirective = buildFrameAncestorsDirective();
    if (!contentSecurityPolicy?.trim()) {
        return frameAncestorsDirective;
    }

    const directives = contentSecurityPolicy
        .split(';')
        .map((directive) => directive.trim())
        .filter(Boolean)
        .filter((directive) => !directive.toLowerCase().startsWith('frame-ancestors'));

    directives.push(frameAncestorsDirective);
    return directives.join('; ');
};

const readJupyterNativeToken = (): string => {
    const token = process.env.JUPYTER_TOKEN?.trim();
    return token || 'volt-scripting';
};

@injectable()
export class ScriptingJupyterProxyService {
    private readonly webSocketServer = new WebSocketServer({
        noServer: true
    });
    private readonly jupyterNativeToken = readJupyterNativeToken();

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
            const runtime = await this.requireNotebookRuntime(context);
            this.persistAccessTokenCookie(req, res, context);
            const target = this.extractProxyTarget(req.originalUrl);
            const tunnel = await this.openNotebookTunnel(context.teamClusterId, runtime, TeamClusterServiceExposureAccessMode.Http);
            const upstreamAgent = this.createSingleUseTunnelHttpAgent(tunnel);
            const destroyUpstreamAgent = (): void => {
                upstreamAgent.destroy();
            };
            const upstreamRequest = http.request(this.buildUpstreamHttpRequestOptions(req, runtime, target, upstreamAgent), (upstreamResponse) => {
                upstreamResponse.once('close', destroyUpstreamAgent);
                this.prepareProxyResponse(req.originalUrl, res, upstreamResponse.headers, upstreamResponse.statusCode || 502, context);
                upstreamResponse.on('error', (error: Error) => {
                    res.destroy(error);
                });
                upstreamResponse.pipe(res);
            });

            res.once('close', destroyUpstreamAgent);

            upstreamRequest.on('error', (error: Error) => {
                destroyUpstreamAgent();
                const mappedError = this.mapNotebookProxyError(error);
                if (!res.headersSent) {
                    this.applyProxyResponseSecurityHeaders(res);
                    BaseResponse.fromError(res, mappedError);
                    return;
                }

                res.destroy(mappedError instanceof Error ? mappedError : error);
            });

            this.writeProxyRequestBody(req, upstreamRequest);
        } catch (error: unknown) {
            const mappedError = this.mapNotebookProxyError(error);
            this.applyProxyResponseSecurityHeaders(res);
            BaseResponse.fromError(res, mappedError);
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
            const runtime = await this.requireNotebookRuntime(context);
            const target = this.extractProxyTarget(request.url || '');
            const tunnel = await this.openNotebookTunnel(context.teamClusterId, runtime, TeamClusterServiceExposureAccessMode.WebSocket);
            const upstreamWebSocket = new WebSocket(
                `ws://${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}${target.proxiedPath}${target.rawQuery}`,
                {
                    createConnection: () => tunnel,
                    headers: this.readUpgradeRequestHeaders(request, runtime)
                }
            );

            this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.bindWebSocketProxy(webSocket, upstreamWebSocket);
            });
        } catch (error: unknown) {
            const mappedError = this.mapNotebookProxyError(error);
            const statusCode = mappedError instanceof ApplicationError ? mappedError.statusCode : 500;
            const message = mappedError instanceof Error ? mappedError.message : 'WebSocket upgrade failed';
            writeUpgradeError(socket, statusCode, message);
        }
    };

    private mapNotebookProxyError(error: unknown): unknown {
        if (!this.isDaemonProxyUnavailableError(error)) {
            return error;
        }

        return new ApplicationError(
            ErrorCodes.SCRIPTING_DAEMON_UNAVAILABLE,
            JUPYTER_PROXY_TEMPORARY_UNAVAILABLE_MESSAGE,
            503
        );
    }

    private isDaemonProxyUnavailableError(error: unknown): boolean {
        if (error instanceof ApplicationError && error.code === 'TeamCluster::DaemonUnavailable') {
            return true;
        }

        if (!(error instanceof Error)) {
            return false;
        }

        const normalizedMessage = error.message.toLowerCase();
        return DAEMON_PROXY_UNAVAILABLE_ERROR_MESSAGES.some((message) => normalizedMessage.includes(message));
    }

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

    private bindWebSocketProxy(webSocket: WebSocket, upstreamWebSocket: WebSocket): void {
        upstreamWebSocket.on('message', (data, isBinary) => {
            const payload = normalizeWebSocketPayload(data);
            webSocket.send(payload, {
                binary: isBinary
            });
        });
        upstreamWebSocket.on('close', (code, reason) => {
            webSocket.close(code || 1000, reason.toString() || undefined);
        });
        upstreamWebSocket.on('error', () => {
            webSocket.close(1011, 'Remote Jupyter websocket failed');
        });

        webSocket.on('message', (data, isBinary) => {
            const message = normalizeWebSocketPayload(data);
            upstreamWebSocket.send(message, {
                binary: isBinary
            });
        });
        webSocket.on('close', () => {
            upstreamWebSocket.close();
        });
        webSocket.on('error', () => {
            upstreamWebSocket.close();
        });
    }

    private prepareProxyResponse(
        requestUrl: string,
        res: Response,
        headers: IncomingHttpHeaders,
        status: number,
        context: AuthorizedProxyContext
    ): void {
        const upstreamContentSecurityPolicy = this.readHeaderValue(headers['content-security-policy']);
        this.applyProxyResponseSecurityHeaders(res, upstreamContentSecurityPolicy);
        res.status(status);

        for (const [headerName, headerValue] of Object.entries(headers)) {
            if (typeof headerValue === 'undefined') {
                continue;
            }

            const normalizedHeaderName = headerName.toLowerCase();
            if (normalizedHeaderName === 'transfer-encoding' || normalizedHeaderName === 'content-encoding') {
                continue;
            }

            if (normalizedHeaderName === 'x-frame-options' || normalizedHeaderName === 'content-security-policy') {
                continue;
            }

            if (normalizedHeaderName === 'location') {
                res.setHeader(headerName, this.rewriteProxyLocation(this.readHeaderValue(headerValue) || '', requestUrl, context));
                continue;
            }

            res.setHeader(headerName, Array.isArray(headerValue) ? headerValue.join(', ') : headerValue);
        }
    }

    private applyProxyResponseSecurityHeaders(res: Response, upstreamContentSecurityPolicy?: string): void {
        res.removeHeader('x-frame-options');
        res.removeHeader('content-security-policy');
        res.setHeader('Content-Security-Policy', rewriteFrameAncestorsDirective(upstreamContentSecurityPolicy));
    }

    private readProxyRequestHeaders(headersInput: IncomingHttpHeaders): Record<string, string> {
        const headers: Record<string, string> = {};

        for (const [headerName, headerValue] of Object.entries(headersInput)) {
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

    private readRequestMethod(method: string): 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' {
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
            return method;
        }

        return 'GET';
    }

    private resolveAction(method: string): Action {
        return METHOD_ACTION_MAP[method] || Action.READ;
    }

    private async requireNotebookRuntime(
        context: AuthorizedProxyContext
    ): Promise<TeamClusterDaemonNotebookRuntime> {
        const { runtime } = await this.teamClusterDaemonClient.getNotebookRuntime(context.teamClusterId, context.runtimeNotebookId);

        if (!runtime) {
            throw new ApplicationError(
                'Scripting::JupyterUnavailable',
                'Jupyter runtime is not ready yet',
                503
            );
        }

        return runtime;
    }

    private openNotebookTunnel(
        teamClusterId: string,
        runtime: TeamClusterDaemonNotebookRuntime,
        accessMode: TeamClusterServiceExposureAccessMode
    ): Promise<Duplex> {
        return this.teamClusterDaemonClient.openTunnel(teamClusterId, {
            targetHost: runtime.tunnelTargetHost,
            targetPort: runtime.tunnelTargetPort,
            accessMode
        });
    }

    private createSingleUseTunnelHttpAgent(tunnel: Duplex): http.Agent {
        const agent = new http.Agent({
            keepAlive: false,
            maxSockets: 1
        });

        agent.createConnection = (): Duplex => {
            return tunnel;
        };

        return agent;
    }

    private buildUpstreamHttpRequestOptions(
        req: Request,
        runtime: TeamClusterDaemonNotebookRuntime,
        target: ProxyTarget,
        agent: http.Agent
    ): RequestOptions {
        const headers = this.readProxyRequestHeaders(req.headers);
        headers.host = `${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}`;

        return {
            protocol: 'http:',
            hostname: runtime.tunnelTargetHost,
            host: runtime.tunnelTargetHost,
            port: runtime.tunnelTargetPort,
            method: this.readRequestMethod(req.method),
            path: `${target.proxiedPath}${target.rawQuery}`,
            headers,
            agent
        };
    }

    private writeProxyRequestBody(req: Request, upstreamRequest: http.ClientRequest): void {
        const body = this.readRequestBody(req.body);
        if (body) {
            upstreamRequest.end(JSON.stringify(body));
            return;
        }

        req.pipe(upstreamRequest);
    }

    private readUpgradeRequestHeaders(
        request: IncomingMessage,
        runtime: TeamClusterDaemonNotebookRuntime
    ): Record<string, string> {
        const headers = this.readProxyRequestHeaders(request.headers);

        for (const headerName of Object.keys(headers)) {
            const normalizedHeaderName = headerName.toLowerCase();
            if (
                normalizedHeaderName === 'connection'
                || normalizedHeaderName === 'upgrade'
                || normalizedHeaderName.startsWith('sec-websocket-')
            ) {
                delete headers[headerName];
            }
        }

        headers.host = `${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}`;

        return headers;
    }

    private extractProxyTarget(
        requestUrl: string
    ): ProxyTarget {
        const url = new URL(requestUrl, PROXY_URL_ORIGIN);
        const proxiedPath = url.pathname;

        url.searchParams.delete(ACCESS_TOKEN_QUERY_PARAM);
        url.searchParams.set(JUPYTER_NATIVE_TOKEN_QUERY_PARAM, this.jupyterNativeToken);

        const search = url.searchParams.toString();
        return {
            proxiedPath,
            rawQuery: search ? `?${search}` : ''
        };
    }

    private rewriteProxyLocation(requestLocation: string, requestUrl: string, context: AuthorizedProxyContext): string {
        const publicProxyBasePath = this.buildPublicProxyBasePath(context.teamId, context.runtimeNotebookId);
        const requestUrlObject = new URL(requestUrl, PROXY_URL_ORIGIN);
        const currentProxyTarget = this.extractProxyTarget(requestUrl);
        const upstreamRequestUrl = new URL(`${currentProxyTarget.proxiedPath}${currentProxyTarget.rawQuery}`, UPSTREAM_URL_ORIGIN);
        const resolvedLocation = new URL(requestLocation, upstreamRequestUrl);
        const rewrittenUrl = new URL(PROXY_URL_ORIGIN);
        const normalizedPathname = this.normalizeUpstreamProxyPath(resolvedLocation.pathname, publicProxyBasePath);

        rewrittenUrl.pathname = normalizedPathname.startsWith(publicProxyBasePath)
            ? normalizedPathname
            : `${publicProxyBasePath}${normalizedPathname === '/' ? '' : normalizedPathname}`;
        rewrittenUrl.search = resolvedLocation.search;
        rewrittenUrl.hash = resolvedLocation.hash;
        rewrittenUrl.searchParams.delete(JUPYTER_NATIVE_TOKEN_QUERY_PARAM);

        const accessToken = requestUrlObject.searchParams.get(ACCESS_TOKEN_QUERY_PARAM);
        if (accessToken && !rewrittenUrl.searchParams.has(ACCESS_TOKEN_QUERY_PARAM)) {
            rewrittenUrl.searchParams.set(ACCESS_TOKEN_QUERY_PARAM, accessToken);
        }

        return `${rewrittenUrl.pathname}${rewrittenUrl.search}${rewrittenUrl.hash}`;
    }

    private normalizeUpstreamProxyPath(pathname: string, publicProxyBasePath: string): string {
        const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
        if (normalizedPathname === publicProxyBasePath) {
            return '/';
        }

        if (normalizedPathname.startsWith(`${publicProxyBasePath}/`)) {
            return normalizedPathname.slice(publicProxyBasePath.length);
        }

        return normalizedPathname;
    }

    private buildPublicProxyBasePath(teamId: string, runtimeNotebookId: string): string {
        return `${JUPYTER_PROXY_BASE_PATH}/${encodeURIComponent(teamId)}/notebooks/${encodeURIComponent(runtimeNotebookId)}`;
    }

    private matchProxyPath(requestUrl: string): ProxyPathMatch | null {
        const url = new URL(requestUrl, PROXY_URL_ORIGIN);
        const match = url.pathname.match(/^\/api\/jupyter\/([^/]+)\/notebooks\/([^/]+)(\/.*)?$/);
        if (!match) {
            return null;
        }

        return {
            teamId: decodeURIComponent(match[1]),
            runtimeNotebookId: decodeURIComponent(match[2])
        };
    }

    private readAccessTokenFromUrl(requestUrl: string): string | null {
        const url = new URL(requestUrl, PROXY_URL_ORIGIN);
        return url.searchParams.get(ACCESS_TOKEN_QUERY_PARAM);
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }
};
