import { ErrorCodes } from '@core/constants/error-codes';
import {
    CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME,
    CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    ContainerPortProxyAccessTokenService,
    buildContainerPortProxyRelayUrl,
    readContainerPortProxyAccessTokenFromUrl,
    resolveContainerPortProxyRelayProtocol
} from '@modules/container/infrastructure/utilities/container-port-proxy';
import { TeamClusterServiceExposureAccessMode } from '@modules/cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { LocalRelayPortAllocator } from '@shared/infrastructure/services/LocalRelayPortAllocator';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import {
    readRelayHostValue,
    readRelayPortRangeValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import httpProxy from 'http-proxy';
import { randomBytes } from 'node:crypto';
import type {
    IncomingMessage,
    ServerResponse
} from 'node:http';
import http from 'node:http';
import type { Duplex } from 'node:stream';
import { injectable } from 'tsyringe';

interface CreateContainerPortProxyRelaySessionInput {
    teamId: string;
    containerId: string;
    userId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
}

interface ContainerPortProxyRelaySession {
    sessionId: string;
    relayPort: number;
    teamId: string;
    containerId: string;
    userId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
    expiresAt: number;
    server: http.Server;
    cleanupTimer: NodeJS.Timeout;
}

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
}

const DEFAULT_SESSION_TTL_MS = 600_000;
const DEFAULT_RELAY_BIND_HOST = '0.0.0.0';
const DEFAULT_RELAY_PORT_START = 24000;
const DEFAULT_RELAY_PORT_END = 24999;
const PROXY_URL_ORIGIN = 'http://volt.local';

const readCookies = (rawCookieHeader?: string): Record<string, string | undefined> => {
    if (!rawCookieHeader) {
        return {};
    }

    return parseCookie(rawCookieHeader);
};

@injectable()
export class ContainerPortProxyRelayService {
    private readonly sessionTtlMs = readPositiveIntegerEnv('CONTAINER_PORT_PROXY_SESSION_TTL_MS', DEFAULT_SESSION_TTL_MS);
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost, 'TEAM_CLUSTER_APP_PROXY_ADVERTISED_HOST');
    private readonly publicProtocol = resolveContainerPortProxyRelayProtocol();
    private readonly portStart = readRelayPortRangeValue('TEAM_CLUSTER_APP_PROXY_PORT_START', DEFAULT_RELAY_PORT_START);
    private readonly portEnd = readRelayPortRangeValue('TEAM_CLUSTER_APP_PROXY_PORT_END', DEFAULT_RELAY_PORT_END);
    private readonly sessionsById = new Map<string, ContainerPortProxyRelaySession>();
    private readonly portAllocator = new LocalRelayPortAllocator({
        portStart: this.portStart,
        portEnd: this.portEnd,
        exhaustedMessage: 'No available container app relay ports'
    });

    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly accessTokenService: ContainerPortProxyAccessTokenService
    ) {}

    async createSession(input: CreateContainerPortProxyRelaySessionInput): Promise<{ url: string; expiresAt: string; }> {
        const relayPort = this.portAllocator.reservePort();
        const sessionId = randomBytes(16).toString('hex');
        const expiresAt = Date.now() + this.sessionTtlMs;
        const server = http.createServer((req, res) => {
            this.handleHttpRequest(sessionId, req, res).catch((error: unknown) => {
                this.writeHttpError(res, error);
            });
        });

        server.on('upgrade', (request, socket, head) => {
            this.handleUpgrade(sessionId, request, socket, head).catch((error: unknown) => {
                const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
                const message = error instanceof Error ? error.message : 'WebSocket upgrade failed';
                writeUpgradeError(socket, statusCode, message);
            });
        });

        await this.portAllocator.listen(server, relayPort, this.bindHost);

        const cleanupTimer = setTimeout(() => {
            this.closeSession(sessionId).catch(() => {
                logger.error(`Failed to close expired container port proxy session sessionId=${sessionId}`);
            });
        }, this.sessionTtlMs);
        cleanupTimer.unref();

        const session: ContainerPortProxyRelaySession = {
            sessionId,
            relayPort,
            teamId: input.teamId,
            containerId: input.containerId,
            userId: input.userId,
            teamClusterId: input.teamClusterId,
            internalIp: input.internalIp,
            privatePort: input.privatePort,
            expiresAt,
            server,
            cleanupTimer
        };

        this.sessionsById.set(sessionId, session);

        const url = buildContainerPortProxyRelayUrl({
            sessionId,
            relayPort,
            userId: input.userId,
            advertisedHost: this.advertisedHost,
            protocol: this.publicProtocol,
            createAccessToken: this.accessTokenService.create.bind(this.accessTokenService)
        });

        logger.info(`Created container port proxy relay session sessionId=${sessionId} relayPort=${relayPort} teamId=${input.teamId} containerId=${input.containerId}`);

        return {
            url,
            expiresAt: new Date(expiresAt).toISOString()
        };
    }

    private async handleHttpRequest(
        sessionId: string,
        req: IncomingMessage,
        res: ServerResponse<IncomingMessage>
    ): Promise<void> {
        const session = this.requireAuthorizedSession(sessionId, req.url || '/', this.readHeaderValue(req.headers.cookie));
        const accessTokenFromUrl = readContainerPortProxyAccessTokenFromUrl(req.url || '/');

        const target = this.extractProxyTarget(req.url || '/');
        const tunnel = await this.teamClusterDaemonClient.openTunnel(session.teamClusterId, {
            targetHost: session.internalIp,
            targetPort: session.privatePort,
            accessMode: TeamClusterServiceExposureAccessMode.Http
        });
        const agent = this.createSingleUseTunnelHttpAgent(tunnel);
        const proxy = httpProxy.createProxyServer();
        const originalUrl = req.url;

        const cleanup = (): void => {
            agent.destroy();
            proxy.removeAllListeners();
        };

        proxy.once('proxyRes', (proxyResponse) => {
            const location = proxyResponse.headers.location;
            if (typeof location === 'string') {
                proxyResponse.headers.location = this.rewriteLocationHeader(location, session);
            }

            // Why: `http-proxy` copies upstream `Set-Cookie` into `res` via
            // `res.setHeader`, which REPLACES any cookie we had set beforehand.
            // Merging into `proxyResponse.headers['set-cookie']` here (before
            // http-proxy writes them out) is the only way to keep our auth
            // cookie alive alongside the container's own cookies. Without this,
            // the browser never receives the session cookie, subsequent
            // requests (including the workbench's WebSocket upgrade) arrive
            // without credentials, and the relay replies 401 — which surfaces
            // in the browser as a bare `WebSocket close 1006`.
            if (accessTokenFromUrl) {
                proxyResponse.headers['set-cookie'] = this.appendAccessTokenCookie(
                    proxyResponse.headers['set-cookie'],
                    accessTokenFromUrl,
                    session
                );
            }

            proxyResponse.once('close', cleanup);
        });

        proxy.once('error', (error) => {
            cleanup();
            if (!res.headersSent) {
                this.writeHttpError(res, error);
                return;
            }

            res.destroy(error);
        });

        res.once('close', cleanup);
        req.url = `${target.proxiedPath}${target.rawQuery}`;
        proxy.web(req, res, {
            target: `http://${session.internalIp}:${session.privatePort}`,
            agent,
            changeOrigin: true,
            xfwd: true
        });
        req.url = originalUrl;
    }

    private async handleUpgrade(sessionId: string, request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const session = this.requireAuthorizedSession(sessionId, request.url || '/', this.readHeaderValue(request.headers.cookie));
        const target = this.extractProxyTarget(request.url || '/');
        const tunnel = await this.teamClusterDaemonClient.openTunnel(session.teamClusterId, {
            targetHost: session.internalIp,
            targetPort: session.privatePort,
            accessMode: TeamClusterServiceExposureAccessMode.WebSocket
        });
        const agent = this.createSingleUseTunnelHttpAgent(tunnel);
        const proxy = httpProxy.createProxyServer({
            ws: true
        });
        const originalUrl = request.url;

        const cleanup = (): void => {
            agent.destroy();
            proxy.removeAllListeners();
        };

        proxy.once('error', (error) => {
            cleanup();
            writeUpgradeError(socket, 502, error.message || 'Upstream WebSocket connection failed');
        });

        socket.once('close', cleanup);
        request.url = `${target.proxiedPath}${target.rawQuery}`;
        proxy.ws(request, socket, head, {
            target: `ws://${session.internalIp}:${session.privatePort}`,
            agent,
            changeOrigin: true,
            xfwd: true
        });
        request.url = originalUrl;
    }

    private requireAuthorizedSession(
        expectedSessionId: string,
        requestUrl: string,
        cookieHeader: string | undefined
    ): ContainerPortProxyRelaySession {
        const session = this.sessionsById.get(expectedSessionId);
        if (!session) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container proxy session was not found');
        }

        if (Date.now() >= session.expiresAt) {
            this.closeSession(session.sessionId).catch(() => {
                logger.error(`Failed to close expired container port proxy session sessionId=${session.sessionId}`);
            });
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'Container proxy session expired');
        }

        const cookieToken = readCookies(cookieHeader)[CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME];
        const accessToken = readContainerPortProxyAccessTokenFromUrl(requestUrl) || cookieToken;
        if (!accessToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        const verifiedToken = this.accessTokenService.verify(accessToken);
        if (!verifiedToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        }

        if (
            verifiedToken.sessionId !== session.sessionId
            || verifiedToken.relayPort !== session.relayPort
            || verifiedToken.userId !== session.userId
        ) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, ErrorCodes.TEAM_ACCESS_DENIED);
        }

        return session;
    }

    private appendAccessTokenCookie(
        existing: string | string[] | undefined,
        accessToken: string,
        session: ContainerPortProxyRelaySession
    ): string[] {
        const ourCookie = serializeCookie(CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME, accessToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000))
        });

        if (Array.isArray(existing)) {
            return [...existing, ourCookie];
        }

        if (typeof existing === 'string' && existing.length > 0) {
            return [existing, ourCookie];
        }

        return [ourCookie];
    }

    private createSingleUseTunnelHttpAgent(tunnel: Duplex): http.Agent {
        const agent = new http.Agent({
            keepAlive: false,
            maxSockets: 1
        });

        agent.createConnection = (): Duplex => tunnel;
        return agent;
    }

    private extractProxyTarget(requestUrl: string): ProxyTarget {
        const url = new URL(requestUrl, PROXY_URL_ORIGIN);
        url.searchParams.delete(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM);

        const search = url.searchParams.toString();
        return {
            proxiedPath: url.pathname || '/',
            rawQuery: search ? `?${search}` : ''
        };
    }

    private rewriteLocationHeader(location: string, session: ContainerPortProxyRelaySession): string {
        if (!location) {
            return location;
        }

        try {
            const resolvedLocation = new URL(location, `http://${session.internalIp}:${session.privatePort}/`);
            if (
                resolvedLocation.hostname === session.internalIp
                && Number(resolvedLocation.port || '80') === session.privatePort
            ) {
                return `${resolvedLocation.pathname}${resolvedLocation.search}${resolvedLocation.hash}`;
            }

            return location;
        } catch {
            return location;
        }
    }

    private writeHttpError(res: ServerResponse<IncomingMessage>, error: unknown): void {
        const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
        const message = error instanceof Error ? error.message : 'Container app proxy failed';

        if (res.headersSent) {
            res.destroy(error instanceof Error ? error : undefined);
            return;
        }

        res.statusCode = statusCode;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            status: 'error',
            message
        }));
    }

    private async closeSession(sessionId: string): Promise<void> {
        const session = this.sessionsById.get(sessionId);
        if (!session) {
            return;
        }

        clearTimeout(session.cleanupTimer);
        this.sessionsById.delete(sessionId);

        await this.portAllocator.close(session.server);
        this.portAllocator.releasePort(session.relayPort);

        logger.info(`Closed container port proxy relay session sessionId=${sessionId} relayPort=${session.relayPort} teamId=${session.teamId} containerId=${session.containerId}`);
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }
}
