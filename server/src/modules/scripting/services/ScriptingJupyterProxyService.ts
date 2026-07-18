import { ErrorCodes } from '@core/constants/error-codes';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import {
    buildJupyterProxyBasePath,
    findNotebookExposure,
    JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME,
    JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    JUPYTER_PROXY_BASE_PATH,
    matchJupyterProxyPath,
    PROXY_URL_ORIGIN,
    setJupyterProxyAccessCookie
} from '@modules/scripting/utilities/jupyter-proxy';
import {
    TeamClusterServiceExposureAccessMode
} from '@shared/contracts/types';
import type { ITeamClusterExposureRegistryService } from '@shared/contracts/ports';
import { CLUSTER_SERVICE_TOKENS } from '@shared/contracts/tokens/ClusterServiceTokens';
import { getTeamMemberRolePermissions } from '@modules/team/entities/team-member/TeamMember';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { ReverseWsHttpRelay } from '@shared/infrastructure/services/ReverseWsHttpRelay';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import {
    applyEmbeddableHeadersToProxyResponse,
    applyEmbeddableHeadersToResponse
} from '@shared/infrastructure/utilities/response-security-headers';
import { buildWebSocketProtocolList } from '@shared/infrastructure/utilities/websocket-protocols';
import { parse as parseCookie } from 'cookie';
import type { Request, Response } from 'express';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import http from 'node:http';
import { Duplex } from 'node:stream';

interface ProxyableRequest extends Request {
    rawBody?: Buffer;
}

interface AuthorizedProxyContext {
    teamId: string;
    runtimeNotebookId: string;
    teamClusterId: string;
    userId: string;
}

/**
 * Resolved tunnel target for a notebook's runtime container, read from the
 * cluster exposure snapshot (a notebook is a `volt.managed` container exposure).
 * Replaces the former daemon `notebook.runtime.get` RPC response shape.
 */
interface NotebookRuntimeTarget {
    tunnelTargetHost: string;
    tunnelTargetPort: number;
}

interface TeamMemberRolePopulate {
    path: 'role';
    select: ['permissions'];
}

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
}

interface AuthorizedProxyCacheEntry {
    expiresAt: number;
    contextPromise?: Promise<AuthorizedProxyContext>;
    contextValue?: AuthorizedProxyContext;
}

interface HttpProxySessionEntry {
    agent: http.Agent;
    ephemeral: boolean;
    expiresAt: number;
    inUse: boolean;
    key: string;
    runtimeNotebookId: string;
    teamClusterId: string;
    tunnel: Duplex;
}

const JUPYTER_NATIVE_TOKEN_QUERY_PARAM = 'token';
const UPGRADE_ACTION = Action.READ;
const UPSTREAM_URL_ORIGIN = 'http://upstream.local';
const JUPYTER_PROXY_TEMPORARY_UNAVAILABLE_MESSAGE = 'Jupyter proxy is temporarily unavailable';
const DAEMON_PROXY_UNAVAILABLE_ERROR_MESSAGES = [
    'team cluster daemon connection was lost',
    'team cluster daemon reverse channel is not connected',
    'team cluster daemon connection is not ready yet'
];
const AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS = 30_000;
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

const readCookies = (rawCookieHeader?: string): Record<string, string | undefined> => {
    if (!rawCookieHeader) {
        return {};
    }

    return parseCookie(rawCookieHeader);
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

@Singleton()
export class ScriptingJupyterProxyService {
    private readonly jupyterNativeToken = readJupyterNativeToken();
    private readonly authorizedProxyContextCache = new Map<string, AuthorizedProxyCacheEntry>();
    private readonly httpProxySessions = new Map<string, HttpProxySessionEntry[]>();
    private readonly accessTokenService = new ScriptingJupyterAccessTokenService();

    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        private readonly reverseWsHttpRelay: ReverseWsHttpRelay,
        @inject(CLUSTER_SERVICE_TOKENS.TeamClusterExposureRegistryService) private readonly exposureRegistryService: ITeamClusterExposureRegistryService
    ) {
        this.startHttpProxySessionSweep();
    }

    public proxyHttpRequest = async (req: Request, res: Response): Promise<void> => {
        let httpProxySession: HttpProxySessionEntry | null = null;

        try {
            const context = await this.authorizeHttpRequest(req);
            const runtime = await this.requireNotebookRuntime(context);
            this.persistAccessTokenCookie(req, res, context);
            const target = this.extractProxyTarget(req.originalUrl);
            httpProxySession = await this.acquireHttpProxySession(context, runtime);
            const requestBody = this.readProxyRequestBuffer(req);
            const session = httpProxySession;

            this.reverseWsHttpRelay.proxyHttp({
                req,
                res,
                agent: session.agent,
                upstreamOrigin: `http://${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}`,
                rewrittenUrl: `${target.proxiedPath}${target.rawQuery}`,
                requestBody,
                onProxyRes: (proxyResponse) => {
                    this.prepareProxyResponse(req.originalUrl, res, proxyResponse.headers, context);
                },
                onSettled: (destroy) => {
                    this.releaseHttpProxySession(session, destroy);
                },
                onError: (error: Error) => {
                    const mappedError = this.mapNotebookProxyError(error);
                    if (!res.headersSent) {
                        applyEmbeddableHeadersToResponse(res);
                        BaseResponse.fromError(res, mappedError);
                        return;
                    }

                    res.destroy(mappedError instanceof Error ? mappedError : error);
                }
            });
        } catch (error: unknown) {
            if (httpProxySession) {
                this.releaseHttpProxySession(httpProxySession, true);
            }
            const mappedError = this.mapNotebookProxyError(error);
            applyEmbeddableHeadersToResponse(res);
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

            await this.reverseWsHttpRelay.proxyWebSocketUpgrade({
                teamClusterId: context.teamClusterId,
                request,
                socket,
                head,
                upstreamWebSocketUrl,
                requestedProtocols
            });
        } catch (error: unknown) {
            const mappedError = this.mapNotebookProxyError(error);
            const statusCode = mappedError instanceof ApplicationError ? mappedError.statusCode : 500;
            const message = mappedError instanceof Error ? mappedError.message : 'WebSocket upgrade failed';

            logger.warn(`Rejected Jupyter websocket upgrade requestUrl=${requestUrl} statusCode=${statusCode}`);

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

        logger.debug(`Resolving Jupyter proxy authorization context teamId=${match.teamId} runtimeNotebookId=${match.runtimeNotebookId} userId=${verifiedToken.userId} permissionAction=${action}`);

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

        const notebook = await ScriptingNotebookModel.findOne({
            team: teamId,
            runtimeNotebookId
        }).exec();

        if (!notebook || !notebook.teamCluster || !notebook.runtimeNotebookId) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook runtime not found');
        }

        return {
            teamId,
            runtimeNotebookId,
            teamClusterId: String(notebook.teamCluster),
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
            logger.debug(`Serving cached Jupyter proxy authorization context cacheKey=${cacheKey} source=${'value'}`);
            return cachedEntry.contextValue;
        }

        if (cachedEntry.contextPromise) {
            logger.debug(`Joining in-flight Jupyter proxy authorization context resolution cacheKey=${cacheKey} source=${'in-flight'}`);
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

    private buildUpstreamWebSocketUrl(
        runtime: NotebookRuntimeTarget,
        target: ProxyTarget
    ): string {
        return `ws://${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}${target.proxiedPath}${target.rawQuery}`;
    }

    private buildUpgradeLogContext(
        requestUrl: string,
        context: AuthorizedProxyContext,
        runtime: NotebookRuntimeTarget,
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
        context: AuthorizedProxyContext
    ): void {
        applyEmbeddableHeadersToProxyResponse(headers);

        const location = this.readHeaderValue(headers.location);
        if (location) {
            headers.location = this.rewriteProxyLocation(location, requestUrl, context);
        }

        if (headers['set-cookie']) {
            const mergedSetCookies = this.mergeSetCookieHeaders(res.getHeader('set-cookie'), headers['set-cookie']);
            if (mergedSetCookies.length > 0) {
                headers['set-cookie'] = mergedSetCookies;
            } else {
                delete headers['set-cookie'];
            }
        }
    }

    private readProxyRequestBuffer(req: ProxyableRequest): Buffer | undefined {
        if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
            return req.rawBody;
        }

        if (Buffer.isBuffer(req.body)) {
            return req.body;
        }

        if (typeof req.body === 'string') {
            return Buffer.from(req.body);
        }

        if (typeof req.body === 'number' || typeof req.body === 'boolean') {
            return Buffer.from(String(req.body));
        }

        if (req.body && typeof req.body === 'object') {
            return Buffer.from(JSON.stringify(req.body));
        }

        return undefined;
    }

    private resolveAction(method: string): Action {
        return METHOD_ACTION_MAP[method] || Action.READ;
    }

    private async requireNotebookRuntime(
        context: AuthorizedProxyContext
    ): Promise<NotebookRuntimeTarget> {
        const exposures = this.exposureRegistryService.listTeamClusterExposures(context.teamClusterId);
        const match = findNotebookExposure(exposures, context.runtimeNotebookId);

        if (!match || !match.ready) {
            throw new ApplicationError(
                'Scripting::JupyterUnavailable',
                'Jupyter runtime is not ready yet',
                503
            );
        }

        return {
            tunnelTargetHost: match.exposure.targetHost,
            tunnelTargetPort: match.exposure.targetPort
        };
    }

    private openNotebookTunnel(
        teamClusterId: string,
        runtime: NotebookRuntimeTarget,
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
        runtime: NotebookRuntimeTarget
    ): string {
        return `${teamClusterId}:${runtimeNotebookId}:${runtime.tunnelTargetHost}:${runtime.tunnelTargetPort}`;
    }

    private async acquireHttpProxySession(
        context: AuthorizedProxyContext,
        runtime: NotebookRuntimeTarget
    ): Promise<HttpProxySessionEntry> {
        const sessionKey = this.buildHttpProxySessionKey(context.teamClusterId, context.runtimeNotebookId, runtime);
        this.pruneExpiredHttpProxySessions(sessionKey);

        const existingSessions = this.httpProxySessions.get(sessionKey) ?? [];
        const reusableSession = existingSessions.find((session) => !session.inUse && !session.tunnel.destroyed);
        if (reusableSession) {
            reusableSession.inUse = true;
            reusableSession.expiresAt = Date.now() + HTTP_PROXY_SESSION_TTL_MS;
            logger.debug(`Reusing Jupyter proxy HTTP session runtimeNotebookId=${context.runtimeNotebookId} teamClusterId=${context.teamClusterId}`);
            return reusableSession;
        }

        const tunnel = await this.openNotebookTunnel(context.teamClusterId, runtime, TeamClusterServiceExposureAccessMode.Http);
        const storeSession = existingSessions.length < MAX_HTTP_PROXY_SESSIONS_PER_RUNTIME;
        const session = this.createHttpProxySession(sessionKey, context, tunnel, !storeSession);

        if (!storeSession) {
            logger.info(`Created ephemeral Jupyter proxy HTTP session because the pooled cap is in use runtimeNotebookId=${context.runtimeNotebookId} teamClusterId=${context.teamClusterId} activeSessions=${existingSessions.length}`);
            return session;
        }

        const nextSessions = [...existingSessions, session];

        this.httpProxySessions.set(sessionKey, nextSessions);
        logger.info(`Created Jupyter proxy HTTP session runtimeNotebookId=${context.runtimeNotebookId} teamClusterId=${context.teamClusterId} activeSessions=${nextSessions.length}`);

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
}
