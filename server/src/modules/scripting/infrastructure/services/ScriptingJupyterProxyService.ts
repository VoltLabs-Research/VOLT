import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { ErrorCodes } from '@core/constants/error-codes';
import { getTeamMemberRolePermissions } from '@modules/team/domain/entities/team-member/TeamMember';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import {
    buildJupyterProxyBasePath,
    JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME,
    JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    JUPYTER_PROXY_BASE_PATH,
    matchJupyterProxyPath,
    setJupyterProxyAccessCookie
} from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import {
    TeamClusterServiceExposureAccessMode
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import {
    normalizeWebSocketPayload,
    writeUpgradeError
} from '@shared/infrastructure/utilities/proxy-relay';
import { buildWebSocketProtocolList } from '@shared/infrastructure/utilities/websocket-protocols';
import { inject, injectable } from 'tsyringe';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { TeamClusterDaemonNotebookRuntime } from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { Request, Response } from 'express';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import type { Duplex } from 'node:stream';

interface ProxyableRequest extends Request {
    rawBody?: Buffer;
};

interface AuthorizedProxyContext {
    teamId: string;
    runtimeNotebookId: string;
    teamClusterId: string;
    userId: string;
};

interface TeamMemberRolePopulate {
    path: 'role';
    select: ['permissions'];
};

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
};

interface AuthorizedProxyCacheEntry {
    expiresAt: number;
    contextPromise?: Promise<AuthorizedProxyContext>;
    contextValue?: AuthorizedProxyContext;
};

interface NotebookRuntimeCacheEntry {
    expiresAt: number;
    runtimePromise?: Promise<TeamClusterDaemonNotebookRuntime>;
    runtimeValue?: TeamClusterDaemonNotebookRuntime;
};

interface HttpProxySessionEntry {
    agent: http.Agent;
    ephemeral: boolean;
    expiresAt: number;
    inUse: boolean;
    key: string;
    runtimeNotebookId: string;
    teamClusterId: string;
    tunnel: Duplex;
};

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
const AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS = 30_000;
const NOTEBOOK_RUNTIME_CACHE_TTL_MS = 30_000;
const HTTP_PROXY_SESSION_TTL_MS = 15_000;
const MAX_HTTP_PROXY_SESSIONS_PER_RUNTIME = 2;

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

        const rawValue = rawValueParts.join('=').trim();

        try {
            cookies[key] = decodeURIComponent(rawValue);
        } catch {
            cookies[key] = rawValue;
        }
    }

    return cookies;
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

const pruneExpiredCacheEntries = <T extends { expiresAt: number }>(cache: Map<string, T>): void => {
    const now = Date.now();

    for (const [cacheKey, cacheEntry] of cache.entries()) {
        if (cacheEntry.expiresAt <= now) {
            cache.delete(cacheKey);
        }
    }
};

@injectable()
export class ScriptingJupyterProxyService {
    private readonly jupyterNativeToken = readJupyterNativeToken();
    private readonly authorizedProxyContextCache = new Map<string, AuthorizedProxyCacheEntry>();
    private readonly notebookRuntimeCache = new Map<string, NotebookRuntimeCacheEntry>();
    private readonly httpProxySessions = new Map<string, HttpProxySessionEntry[]>();
    private readonly httpProxySessionSweepTimer = this.startHttpProxySessionSweep();

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
        let httpProxySession: HttpProxySessionEntry | null = null;

        try {
            const context = await this.authorizeHttpRequest(req);
            const runtime = await this.requireNotebookRuntime(context);
            this.persistAccessTokenCookie(req, res, context);
            const target = this.extractProxyTarget(req.originalUrl);
            httpProxySession = await this.acquireHttpProxySession(context, runtime);
            let releasedSession = false;
            const finalizeHttpProxySession = (destroySession = false): void => {
                if (releasedSession || !httpProxySession) {
                    return;
                }

                releasedSession = true;
                this.releaseHttpProxySession(httpProxySession, destroySession);
            };
            const upstreamRequest = http.request(this.buildUpstreamHttpRequestOptions(req, runtime, target, httpProxySession.agent), (upstreamResponse) => {
                upstreamResponse.once('end', () => {
                    finalizeHttpProxySession(false);
                });
                upstreamResponse.once('close', () => {
                    finalizeHttpProxySession(!res.writableEnded);
                });
                this.prepareProxyResponse(req.originalUrl, res, upstreamResponse.headers, upstreamResponse.statusCode || 502, context);
                upstreamResponse.on('error', (error: Error) => {
                    finalizeHttpProxySession(true);
                    res.destroy(error);
                });
                upstreamResponse.pipe(res);
            });

            req.once('aborted', () => {
                finalizeHttpProxySession(true);
            });
            res.once('close', () => {
                finalizeHttpProxySession(!res.writableEnded);
            });

            upstreamRequest.on('error', (error: Error) => {
                finalizeHttpProxySession(true);
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
            if (httpProxySession) {
                this.releaseHttpProxySession(httpProxySession, true);
            }
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

        const requestUrl = request.url || '';

        try {
            const context = await this.authorizeUpgradeRequest(request);
            const runtime = await this.requireNotebookRuntime(context);
            const requestedProtocols = buildWebSocketProtocolList(request.headers['sec-websocket-protocol']);
            const target = this.extractProxyTarget(requestUrl);
            const upstreamWebSocketUrl = this.buildUpstreamWebSocketUrl(runtime, target);
            const logContext = this.buildUpgradeLogContext(requestUrl, context, runtime, upstreamWebSocketUrl, requestedProtocols);

            logger.info(logContext, 'Opening proxied Jupyter websocket');

            await this.handleReverseChannelWebSocketUpgrade(
                request,
                socket,
                head,
                context,
                upstreamWebSocketUrl,
                requestedProtocols,
                logContext
            );
        } catch (error: unknown) {
            const mappedError = this.mapNotebookProxyError(error);
            const statusCode = mappedError instanceof ApplicationError ? mappedError.statusCode : 500;
            const message = mappedError instanceof Error ? mappedError.message : 'WebSocket upgrade failed';

            logger.warn({
                requestUrl,
                statusCode,
                error: mappedError instanceof Error ? mappedError.message : String(mappedError)
            }, 'Rejected Jupyter websocket upgrade');

            writeUpgradeError(socket, statusCode, message);
        }
    };

    private async handleReverseChannelWebSocketUpgrade(
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
        context: AuthorizedProxyContext,
        upstreamWebSocketUrl: string,
        requestedProtocols: string[] | undefined,
        logContext: Record<string, unknown>
    ): Promise<void> {
        const upstreamWebSocket = await this.teamClusterDaemonClient.attachWebSocket(
            context.teamClusterId,
            upstreamWebSocketUrl,
            requestedProtocols
        );
        const negotiatedProtocol = upstreamWebSocket.protocol || requestedProtocols?.[0];
        logger.info({
            ...logContext,
            upstreamMode: 'reverse-websocket',
            negotiatedProtocol
        }, 'Attached reverse-channel Jupyter websocket session');
        let upgradeSettled = false;

        const cleanupPendingUpgrade = (): void => {
            upstreamWebSocket.removeAllListeners('error');
            upstreamWebSocket.removeAllListeners('end');
            socket.off('close', onClientSocketCloseBeforeReady);
        };

        const finalizePendingUpgrade = (): boolean => {
            if (upgradeSettled) {
                return false;
            }

            upgradeSettled = true;
            cleanupPendingUpgrade();
            return true;
        };

        const failPendingUpgrade = (statusCode: number, message: string, error?: Error): void => {
            if (!finalizePendingUpgrade()) {
                return;
            }

            logger.warn({
                ...logContext,
                statusCode,
                upstreamError: error?.message,
                upstreamMode: 'reverse-websocket'
            }, 'Jupyter websocket upgrade failed before client handshake');

            upstreamWebSocket.destroy();
            writeUpgradeError(socket, statusCode, message);
        };

        const onClientSocketCloseBeforeReady = (): void => {
            if (!finalizePendingUpgrade()) {
                return;
            }

            upstreamWebSocket.destroy();
        };

        upstreamWebSocket.on('error', (error) => {
            failPendingUpgrade(502, error.message || 'Upstream WebSocket connection failed', error);
        });
        upstreamWebSocket.on('end', (payload) => {
            failPendingUpgrade(502, payload.message || 'Upstream WebSocket connection failed');
        });
        socket.once('close', onClientSocketCloseBeforeReady);

        this.completeClientWebSocketUpgrade(request, socket, head, (webSocket) => {
            if (!finalizePendingUpgrade()) {
                webSocket.close(1011, 'Jupyter websocket upgrade already settled');
                return;
            }

            logger.info({
                ...logContext,
                upstreamMode: 'reverse-websocket',
                negotiatedProtocol
            }, 'Completed client Jupyter websocket upgrade');
            this.bindReverseChannelWebSocketProxy(webSocket, upstreamWebSocket, logContext);
        }, negotiatedProtocol);
    }

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
        const match = matchJupyterProxyPath(requestUrl);
        if (!match) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Jupyter proxy route not found');
        }

        const url = new URL(requestUrl, 'http://volt.local');
        const cookieToken = readCookies(cookieHeader)[JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME];
        const accessToken = url.searchParams.get(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM) || cookieToken;
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

        const cacheKey = this.buildAuthorizedProxyContextCacheKey(
            verifiedToken.userId,
            match.teamId,
            match.runtimeNotebookId,
            action
        );
        const cachedContext = this.readAuthorizedProxyContextCache(cacheKey);
        if (cachedContext) {
            return cachedContext;
        }

        logger.debug({
            action: 'scripting.jupyter-proxy.auth-context.cache-miss',
            teamId: match.teamId,
            runtimeNotebookId: match.runtimeNotebookId,
            userId: verifiedToken.userId,
            permissionAction: action
        }, 'Resolving Jupyter proxy authorization context');

        pruneExpiredCacheEntries(this.authorizedProxyContextCache);

        const contextPromise = this.resolveAuthorizedProxyContext(match.teamId, match.runtimeNotebookId, verifiedToken.userId, action)
            .then((context) => {
                this.authorizedProxyContextCache.set(cacheKey, {
                    expiresAt: Date.now() + AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS,
                    contextValue: context
                });

                return context;
            })
            .catch((error: unknown) => {
                this.authorizedProxyContextCache.delete(cacheKey);
                throw error;
            });

        this.authorizedProxyContextCache.set(cacheKey, {
            expiresAt: Date.now() + AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS,
            contextPromise
        });

        return contextPromise;
    }

    private async resolveAuthorizedProxyContext(
        teamId: string,
        runtimeNotebookId: string,
        userId: string,
        action: Action
    ): Promise<AuthorizedProxyContext> {
        const member = await this.teamMemberRepository.findOne({
            user: userId,
            team: teamId
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
            team: teamId,
            runtimeNotebookId
        });

        if (!notebook || !notebook.props.teamCluster || !notebook.props.runtimeNotebookId) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook runtime not found');
        }

        return {
            teamId,
            runtimeNotebookId,
            teamClusterId: notebook.props.teamCluster,
            userId
        };
    }

    private buildAuthorizedProxyContextCacheKey(
        userId: string,
        teamId: string,
        runtimeNotebookId: string,
        action: Action
    ): string {
        return `${userId}:${teamId}:${runtimeNotebookId}:${action}`;
    }

    private readAuthorizedProxyContextCache(cacheKey: string): Promise<AuthorizedProxyContext> | AuthorizedProxyContext | undefined {
        const cachedEntry = this.authorizedProxyContextCache.get(cacheKey);
        const now = Date.now();
        if (!cachedEntry) {
            return undefined;
        }

        if (cachedEntry.expiresAt <= now) {
            this.authorizedProxyContextCache.delete(cacheKey);
            return undefined;
        }

        if (cachedEntry.contextValue) {
            logger.debug({
                action: 'scripting.jupyter-proxy.auth-context.cache-hit',
                cacheKey,
                source: 'value'
            }, 'Serving cached Jupyter proxy authorization context');
            return cachedEntry.contextValue;
        }

        if (cachedEntry.contextPromise) {
            logger.debug({
                action: 'scripting.jupyter-proxy.auth-context.cache-hit',
                cacheKey,
                source: 'in-flight'
            }, 'Joining in-flight Jupyter proxy authorization context resolution');
            return cachedEntry.contextPromise;
        }

        return undefined;
    }

    private persistAccessTokenCookie(req: Request, res: Response, context: AuthorizedProxyContext): void {
        const accessToken = this.accessTokenService.create({
            teamId: context.teamId,
            runtimeNotebookId: context.runtimeNotebookId,
            userId: context.userId
        });

        setJupyterProxyAccessCookie(
            req,
            res,
            accessToken,
            context.teamId,
            context.runtimeNotebookId,
            this.accessTokenService.getCookieMaxAgeMs()
        );
    }

    private bindReverseChannelWebSocketProxy(
        webSocket: WebSocket,
        upstreamWebSocket: TeamClusterReverseWebSocketStream,
        logContext: Record<string, unknown>
    ): void {
        upstreamWebSocket.on('data', ({ data, isBinary }) => {
            if (webSocket.readyState !== WebSocket.OPEN) {
                return;
            }

            webSocket.send(data, {
                binary: isBinary
            });
        });
        upstreamWebSocket.on('end', ({ code, message }) => {
            logger.info({
                ...logContext,
                upstreamMode: 'reverse-websocket',
                closeCode: code,
                closeMessage: message
            }, 'Reverse-channel Jupyter websocket ended');

            if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
                return;
            }

            webSocket.close(code || 1000, message || undefined);
        });
        upstreamWebSocket.on('error', (error) => {
            logger.warn({
                ...logContext,
                upstreamMode: 'reverse-websocket',
                upstreamError: error.message
            }, 'Reverse-channel Jupyter websocket failed');

            if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
                return;
            }

            webSocket.close(1011, 'Remote Jupyter websocket failed');
        });

        webSocket.on('message', (data, isBinary) => {
            const payload = normalizeWebSocketPayload(data);
            upstreamWebSocket.send(payload, isBinary);
        });
        webSocket.on('close', () => {
            upstreamWebSocket.destroy();
        });
        webSocket.on('error', () => {
            upstreamWebSocket.destroy();
        });
    }

    private completeClientWebSocketUpgrade(
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
        onReady: (webSocket: WebSocket) => void,
        negotiatedProtocol?: string
    ): void {
        const webSocketServer = new WebSocketServer({
            noServer: true,
            handleProtocols: negotiatedProtocol
                ? () => negotiatedProtocol
                : undefined
        });
        webSocketServer.handleUpgrade(request, socket, head, onReady);
    }

    private buildUpstreamWebSocketUrl(
        runtime: TeamClusterDaemonNotebookRuntime,
        target: ProxyTarget
    ): string {
        return `ws://${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}${target.proxiedPath}${target.rawQuery}`;
    }

    private buildUpgradeLogContext(
        requestUrl: string,
        context: AuthorizedProxyContext,
        runtime: TeamClusterDaemonNotebookRuntime,
        upstreamWebSocketUrl: string,
        requestedProtocols?: string[]
    ): Record<string, unknown> {
        return {
            requestUrl,
            teamId: context.teamId,
            runtimeNotebookId: context.runtimeNotebookId,
            teamClusterId: context.teamClusterId,
            upstreamWebSocketUrl,
            upstreamHost: runtime.tunnelTargetHost,
            upstreamPort: runtime.tunnelTargetPort,
            requestedProtocols
        };
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
            if (normalizedHeaderName === 'transfer-encoding') {
                continue;
            }

            if (normalizedHeaderName === 'x-frame-options' || normalizedHeaderName === 'content-security-policy') {
                continue;
            }

            if (normalizedHeaderName === 'location') {
                res.setHeader(headerName, this.rewriteProxyLocation(this.readHeaderValue(headerValue) || '', requestUrl, context));
                continue;
            }

            if (normalizedHeaderName === 'set-cookie') {
                const mergedSetCookies = this.mergeSetCookieHeaders(res.getHeader('set-cookie'), headerValue);
                if (mergedSetCookies.length > 0) {
                    res.setHeader(headerName, mergedSetCookies);
                }
                continue;
            }

            res.setHeader(headerName, headerValue);
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
        const cacheKey = this.buildNotebookRuntimeCacheKey(context.teamClusterId, context.runtimeNotebookId);
        const cachedRuntime = this.readNotebookRuntimeCache(cacheKey);
        if (cachedRuntime) {
            return cachedRuntime;
        }

        logger.info({
            action: 'scripting.jupyter-proxy.runtime.cache-miss',
            teamClusterId: context.teamClusterId,
            runtimeNotebookId: context.runtimeNotebookId
        }, 'Resolving Jupyter notebook runtime');

        pruneExpiredCacheEntries(this.notebookRuntimeCache);

        const runtimePromise = this.teamClusterDaemonClient.getNotebookRuntime(context.teamClusterId, context.runtimeNotebookId)
            .then(({ runtime }) => {
                if (!runtime) {
                    throw new ApplicationError(
                        'Scripting::JupyterUnavailable',
                        'Jupyter runtime is not ready yet',
                        503
                    );
                }

                this.notebookRuntimeCache.set(cacheKey, {
                    expiresAt: Date.now() + NOTEBOOK_RUNTIME_CACHE_TTL_MS,
                    runtimeValue: runtime
                });

                return runtime;
            })
            .catch((error: unknown) => {
                this.notebookRuntimeCache.delete(cacheKey);
                throw error;
            });

        this.notebookRuntimeCache.set(cacheKey, {
            expiresAt: Date.now() + NOTEBOOK_RUNTIME_CACHE_TTL_MS,
            runtimePromise
        });

        return runtimePromise;
    }

    private buildNotebookRuntimeCacheKey(teamClusterId: string, runtimeNotebookId: string): string {
        return `${teamClusterId}:${runtimeNotebookId}`;
    }

    private readNotebookRuntimeCache(cacheKey: string): Promise<TeamClusterDaemonNotebookRuntime> | TeamClusterDaemonNotebookRuntime | undefined {
        const cachedEntry = this.notebookRuntimeCache.get(cacheKey);
        const now = Date.now();
        if (!cachedEntry) {
            return undefined;
        }

        if (cachedEntry.expiresAt <= now) {
            this.notebookRuntimeCache.delete(cacheKey);
            return undefined;
        }

        if (cachedEntry.runtimeValue) {
            logger.debug({
                action: 'scripting.jupyter-proxy.runtime.cache-hit',
                cacheKey,
                source: 'value'
            }, 'Serving cached Jupyter notebook runtime');
            return cachedEntry.runtimeValue;
        }

        if (cachedEntry.runtimePromise) {
            logger.debug({
                action: 'scripting.jupyter-proxy.runtime.cache-hit',
                cacheKey,
                source: 'in-flight'
            }, 'Joining in-flight Jupyter notebook runtime lookup');
            return cachedEntry.runtimePromise;
        }

        return undefined;
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

    private buildHttpProxySessionKey(
        teamClusterId: string,
        runtimeNotebookId: string,
        runtime: TeamClusterDaemonNotebookRuntime
    ): string {
        return `${teamClusterId}:${runtimeNotebookId}:${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}`;
    }

    private async acquireHttpProxySession(
        context: AuthorizedProxyContext,
        runtime: TeamClusterDaemonNotebookRuntime
    ): Promise<HttpProxySessionEntry> {
        const sessionKey = this.buildHttpProxySessionKey(context.teamClusterId, context.runtimeNotebookId, runtime);
        this.pruneExpiredHttpProxySessions(sessionKey);

        const existingSessions = this.httpProxySessions.get(sessionKey) ?? [];
        const reusableSession = existingSessions.find((session) => !session.inUse && !session.tunnel.destroyed);
        if (reusableSession) {
            reusableSession.inUse = true;
            reusableSession.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
            logger.debug({
                action: 'scripting.jupyter-proxy.http-session.cache-hit',
                runtimeNotebookId: context.runtimeNotebookId,
                teamClusterId: context.teamClusterId
            }, 'Reusing Jupyter proxy HTTP session');
            return reusableSession;
        }

        const tunnel = await this.openNotebookTunnel(context.teamClusterId, runtime, TeamClusterServiceExposureAccessMode.Http);
        const storeSession = existingSessions.length < MAX_HTTP_PROXY_SESSIONS_PER_RUNTIME;
        const session = this.createHttpProxySession(sessionKey, context, tunnel, !storeSession);

        if (!storeSession) {
            logger.info({
                action: 'scripting.jupyter-proxy.http-session.ephemeral',
                runtimeNotebookId: context.runtimeNotebookId,
                teamClusterId: context.teamClusterId,
                activeSessions: existingSessions.length
            }, 'Created ephemeral Jupyter proxy HTTP session because the pooled cap is in use');
            return session;
        }

        const nextSessions = [...existingSessions, session];

        this.httpProxySessions.set(sessionKey, nextSessions);
        logger.info({
            action: 'scripting.jupyter-proxy.http-session.created',
            runtimeNotebookId: context.runtimeNotebookId,
            teamClusterId: context.teamClusterId,
            activeSessions: nextSessions.length
        }, 'Created Jupyter proxy HTTP session');

        return session;
    }

    private createHttpProxySession(
        sessionKey: string,
        context: AuthorizedProxyContext,
        tunnel: Duplex,
        ephemeral = false
    ): HttpProxySessionEntry {
        const agent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: HTTP_PROXY_SESSION_TTL_MS,
            maxFreeSockets: 1,
            maxSockets: 1
        });
        let connectionConsumed = false;

        agent.createConnection = (): Duplex => {
            connectionConsumed = true;
            return tunnel;
        };

        const session: HttpProxySessionEntry = {
            key: sessionKey,
            runtimeNotebookId: context.runtimeNotebookId,
            teamClusterId: context.teamClusterId,
            tunnel,
            agent,
            ephemeral,
            inUse: true,
            expiresAt: Date.now() + HTTP_PROXY_SESSION_TTL_MS
        };

        const destroySession = (): void => {
            this.destroyHttpProxySession(session);
        };

        tunnel.once('close', destroySession);
        tunnel.once('error', destroySession);

        if (!connectionConsumed) {
            session.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
        }

        return session;
    }

    private releaseHttpProxySession(session: HttpProxySessionEntry, destroySession = false): void {
        if (destroySession || session.tunnel.destroyed || session.ephemeral) {
            this.destroyHttpProxySession(session);
            return;
        }

        session.inUse = false;
        session.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
    }

    private pruneExpiredHttpProxySessions(sessionKey?: string): void {
        const now = Date.now();
        const sessionEntries = sessionKey
            ? [[sessionKey, this.httpProxySessions.get(sessionKey) ?? []] as const]
            : Array.from(this.httpProxySessions.entries());

        for (const [currentSessionKey, sessions] of sessionEntries) {
            for (const session of sessions) {
                if (!session.inUse && (session.expiresAt <= now || session.tunnel.destroyed)) {
                    this.destroyHttpProxySession(session);
                }
            }

            if ((this.httpProxySessions.get(currentSessionKey) ?? []).length === 0) {
                this.httpProxySessions.delete(currentSessionKey);
            }
        }
    }

    private startHttpProxySessionSweep(): NodeJS.Timeout {
        const sweepTimer = setInterval(() => {
            this.pruneExpiredHttpProxySessions();
        }, HTTP_PROXY_SESSION_TTL_MS);
        sweepTimer.unref();
        return sweepTimer;
    }

    private destroyHttpProxySession(session: HttpProxySessionEntry): void {
        const sessions = this.httpProxySessions.get(session.key);
        if (sessions) {
            const nextSessions = sessions.filter((entry) => entry !== session);
            if (nextSessions.length === 0) {
                this.httpProxySessions.delete(session.key);
            } else {
                this.httpProxySessions.set(session.key, nextSessions);
            }
        }

        session.inUse = false;
        session.agent.destroy();
        if (!session.tunnel.destroyed) {
            session.tunnel.destroy();
        }
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

    private writeProxyRequestBody(req: ProxyableRequest, upstreamRequest: http.ClientRequest): void {
        if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
            upstreamRequest.end(req.rawBody);
            return;
        }

        const body = this.readRequestBody(req.body);
        if (body) {
            upstreamRequest.end(JSON.stringify(body));
            return;
        }

        if (Buffer.isBuffer(req.body)) {
            upstreamRequest.end(req.body);
            return;
        }

        if (typeof req.body === 'string') {
            upstreamRequest.end(req.body);
            return;
        }

        if (typeof req.body === 'number' || typeof req.body === 'boolean') {
            upstreamRequest.end(String(req.body));
            return;
        }

        if (typeof req.body !== 'undefined' && (req.readableEnded || req.complete)) {
            upstreamRequest.end();
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

        url.searchParams.delete(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM);
        url.searchParams.set(JUPYTER_NATIVE_TOKEN_QUERY_PARAM, this.jupyterNativeToken);

        const search = url.searchParams.toString();
        return {
            proxiedPath,
            rawQuery: search ? `?${search}` : ''
        };
    }

    private rewriteProxyLocation(requestLocation: string, requestUrl: string, context: AuthorizedProxyContext): string {
        const publicProxyBasePath = this.buildPublicProxyBasePath(context.teamId, context.runtimeNotebookId);
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
        return buildJupyterProxyBasePath(teamId, runtimeNotebookId);
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }

    private mergeSetCookieHeaders(
        existingHeaderValue: number | string | string[] | undefined,
        upstreamHeaderValue: string | string[]
    ): string[] {
        const existingSetCookies = this.normalizeSetCookieHeader(existingHeaderValue);
        const upstreamSetCookies = this.normalizeSetCookieHeader(upstreamHeaderValue);

        return [...existingSetCookies, ...upstreamSetCookies];
    }

    private normalizeSetCookieHeader(value: number | string | string[] | undefined): string[] {
        if (typeof value === 'undefined' || typeof value === 'number') {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        return [value];
    }
};
