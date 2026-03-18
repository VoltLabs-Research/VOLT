import { ErrorCodes } from '@core/constants/error-codes';
import {
    CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME,
    CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    ContainerPortProxyAccessTokenService,
    buildContainerPortProxyRelayUrl,
    readContainerPortProxyAccessTokenFromUrl,
    resolveContainerPortProxyRelayProtocol
} from '@modules/container/infrastructure/utilities/container-port-proxy';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { buildWebSocketProtocolList } from '@shared/infrastructure/utilities/websocket-protocols';
import {
    readRelayHostValue,
    readRelayPortRangeValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { inject, injectable } from 'tsyringe';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface CreateContainerPortProxyRelaySessionInput {
    teamId: string;
    containerId: string;
    userId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
};

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
};

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
};

const DEFAULT_SESSION_TTL_MS = 3_600_000;
const DEFAULT_RELAY_BIND_HOST = '127.0.0.1';
const DEFAULT_RELAY_PORT_START = 24000;
const DEFAULT_RELAY_PORT_END = 24999;
const PROXY_URL_ORIGIN = 'http://volt.local';
const UPSTREAM_URL_ORIGIN = 'http://upstream.local';

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

        try {
            cookies[key] = decodeURIComponent(rawValueParts.join('=').trim());
        } catch {
            continue;
        }
    }

    return cookies;
};

const writeUpgradeError = (socket: Duplex, statusCode: number, message: string): void => {
    socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

const readNumberEnv = (name: string, fallback: number): number => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return fallback;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return value;
};

@injectable()
export class ContainerPortProxyRelayService {
    private readonly sessionTtlMs = readNumberEnv('CONTAINER_PORT_PROXY_SESSION_TTL_MS', DEFAULT_SESSION_TTL_MS);
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost, 'TEAM_CLUSTER_APP_PROXY_ADVERTISED_HOST');
    private readonly publicProtocol = resolveContainerPortProxyRelayProtocol();
    private readonly portStart = readRelayPortRangeValue('TEAM_CLUSTER_APP_PROXY_PORT_START', DEFAULT_RELAY_PORT_START);
    private readonly portEnd = readRelayPortRangeValue('TEAM_CLUSTER_APP_PROXY_PORT_END', DEFAULT_RELAY_PORT_END);
    private readonly sessionsById = new Map<string, ContainerPortProxyRelaySession>();
    private readonly sessionIdsByRelayPort = new Map<number, string>();
    private readonly usedPorts = new Set<number>();
    private readonly webSocketServer = new WebSocketServer({
        noServer: true
    });

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(ContainerPortProxyAccessTokenService)
        private readonly accessTokenService: ContainerPortProxyAccessTokenService
    ) {}

    async createSession(input: CreateContainerPortProxyRelaySessionInput): Promise<{ url: string; expiresAt: string; }> {
        const relayPort = this.reservePort();
        const sessionId = randomBytes(16).toString('hex');
        const expiresAt = Date.now() + this.sessionTtlMs;
        const server = http.createServer((req, res) => {
            this.handleHttpRequest(sessionId, req, res).catch((error: unknown) => {
                this.writeHttpError(res, error);
            });
        });

        server.on('upgrade', (request, socket, head) => {
            this.handleUpgrade(sessionId, request, socket as Duplex, head).catch((error: unknown) => {
                const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
                const message = error instanceof Error ? error.message : 'WebSocket upgrade failed';
                writeUpgradeError(socket as Duplex, statusCode, message);
            });
        });

        try {
            await new Promise<void>((resolve, reject) => {
                server.once('error', reject);
                server.listen(relayPort, this.bindHost, () => {
                    server.removeListener('error', reject);
                    resolve();
                });
            });
        } catch (error) {
            this.usedPorts.delete(relayPort);
            throw error;
        }

        const cleanupTimer = setTimeout(() => {
            void this.closeSession(sessionId);
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
        this.sessionIdsByRelayPort.set(relayPort, sessionId);

        const url = buildContainerPortProxyRelayUrl({
            sessionId,
            relayPort,
            userId: input.userId,
            advertisedHost: this.advertisedHost,
            protocol: this.publicProtocol,
            createAccessToken: this.accessTokenService.create.bind(this.accessTokenService)
        });

        logger.info({
            action: 'container.port-proxy.session.created',
            sessionId,
            relayPort,
            teamId: input.teamId,
            containerId: input.containerId,
            privatePort: input.privatePort,
            expiresAt: new Date(expiresAt).toISOString()
        }, 'Created container port proxy relay session');

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
        this.persistAccessTokenCookie(req, res, session);
        const target = this.extractProxyTarget(req.url || '/');
        const tunnel = await this.teamClusterDaemonClient.openTunnel(session.teamClusterId, {
            targetHost: session.internalIp,
            targetPort: session.privatePort,
            accessMode: TeamClusterServiceExposureAccessMode.Http
        });
        const upstreamAgent = this.createSingleUseTunnelHttpAgent(tunnel);
        const destroyUpstreamAgent = (): void => {
            upstreamAgent.destroy();
        };

        const upstreamRequest = http.request(this.buildUpstreamHttpRequestOptions(req, session, target, upstreamAgent), (upstreamResponse) => {
            upstreamResponse.once('close', destroyUpstreamAgent);
            this.prepareProxyResponse(res, upstreamResponse.headers, upstreamResponse.statusCode || 502, session);
            upstreamResponse.on('error', (error: Error) => {
                res.destroy(error);
            });
            upstreamResponse.pipe(res);
        });

        res.once('close', destroyUpstreamAgent);
        upstreamRequest.on('error', (error: Error) => {
            destroyUpstreamAgent();
            if (!res.headersSent) {
                this.writeHttpError(res, error);
                return;
            }

            res.destroy(error);
        });

        req.pipe(upstreamRequest);
    }

    private async handleUpgrade(sessionId: string, request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const session = this.requireAuthorizedSession(sessionId, request.url || '/', this.readHeaderValue(request.headers.cookie));
        const target = this.extractProxyTarget(request.url || '/');
        const tunnel = await this.teamClusterDaemonClient.openTunnel(session.teamClusterId, {
            targetHost: session.internalIp,
            targetPort: session.privatePort,
            accessMode: TeamClusterServiceExposureAccessMode.WebSocket
        });
        const upstreamWebSocketUrl = `ws://${session.internalIp}:${session.privatePort}${target.proxiedPath}${target.rawQuery}`;
        const requestedProtocols = buildWebSocketProtocolList(request.headers['sec-websocket-protocol']);
        const upstreamWebSocketOptions = {
            createConnection: () => tunnel,
            headers: this.readUpgradeRequestHeaders(request, session)
        };
        const upstreamWebSocket = requestedProtocols
            ? new WebSocket(upstreamWebSocketUrl, requestedProtocols, upstreamWebSocketOptions)
            : new WebSocket(upstreamWebSocketUrl, upstreamWebSocketOptions);

        this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
            this.bindWebSocketProxy(webSocket, upstreamWebSocket);
        });
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
            void this.closeSession(session.sessionId);
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

        if (verifiedToken.sessionId !== session.sessionId || verifiedToken.relayPort !== session.relayPort) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, ErrorCodes.TEAM_ACCESS_DENIED);
        }

        return session;
    }

    private persistAccessTokenCookie(
        req: IncomingMessage,
        res: ServerResponse<IncomingMessage>,
        session: ContainerPortProxyRelaySession
    ): void {
        const accessToken = readContainerPortProxyAccessTokenFromUrl(req.url || '/');
        if (!accessToken) {
            return;
        }

        const cookieSegments = [
            `${CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            `Max-Age=${Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000))}`
        ];

        res.setHeader('set-cookie', cookieSegments.join('; '));
    }

    private bindWebSocketProxy(webSocket: WebSocket, upstreamWebSocket: WebSocket): void {
        upstreamWebSocket.on('message', (data, isBinary) => {
            const payload = normalizeWebSocketPayload(data);
            webSocket.send(payload, { binary: isBinary });
        });
        upstreamWebSocket.on('close', (code, reason) => {
            webSocket.close(code || 1000, reason.toString() || undefined);
        });
        upstreamWebSocket.on('error', () => {
            webSocket.close(1011, 'Remote container websocket failed');
        });

        webSocket.on('message', (data, isBinary) => {
            const message = normalizeWebSocketPayload(data);
            upstreamWebSocket.send(message, { binary: isBinary });
        });
        webSocket.on('close', () => {
            upstreamWebSocket.close();
        });
        webSocket.on('error', () => {
            upstreamWebSocket.close();
        });
    }

    private prepareProxyResponse(
        res: ServerResponse<IncomingMessage>,
        headers: IncomingHttpHeaders,
        status: number,
        session: ContainerPortProxyRelaySession
    ): void {
        res.statusCode = status;

        for (const [headerName, headerValue] of Object.entries(headers)) {
            if (typeof headerValue === 'undefined') {
                continue;
            }

            const normalizedHeaderName = headerName.toLowerCase();
            if (normalizedHeaderName === 'transfer-encoding' || normalizedHeaderName === 'connection') {
                continue;
            }

            if (normalizedHeaderName === 'location') {
                res.setHeader(headerName, this.rewriteLocationHeader(this.readHeaderValue(headerValue) || '', session));
                continue;
            }

            res.setHeader(headerName, headerValue);
        }
    }

    private buildUpstreamHttpRequestOptions(
        req: IncomingMessage,
        session: ContainerPortProxyRelaySession,
        target: ProxyTarget,
        agent: http.Agent
    ): RequestOptions {
        const headers = this.readProxyRequestHeaders(req.headers);
        headers.host = `${session.internalIp}:${session.privatePort}`;
        headers['x-forwarded-host'] = this.readHeaderValue(req.headers.host) || '';
        headers['x-forwarded-proto'] = this.publicProtocol;

        return {
            protocol: 'http:',
            hostname: session.internalIp,
            host: session.internalIp,
            port: session.privatePort,
            method: req.method,
            path: `${target.proxiedPath}${target.rawQuery}`,
            headers,
            agent
        };
    }

    private readUpgradeRequestHeaders(
        request: IncomingMessage,
        session: ContainerPortProxyRelaySession
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

        headers.host = `${session.internalIp}:${session.privatePort}`;
        headers['x-forwarded-host'] = this.readHeaderValue(request.headers.host) || '';
        headers['x-forwarded-proto'] = this.publicProtocol;

        return headers;
    }

    private readProxyRequestHeaders(headersInput: IncomingHttpHeaders): Record<string, string> {
        const headers: Record<string, string> = {};

        for (const [headerName, headerValue] of Object.entries(headersInput)) {
            const normalizedHeaderName = headerName.toLowerCase();
            if (!headerValue || normalizedHeaderName === 'host') {
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
        this.sessionIdsByRelayPort.delete(session.relayPort);
        this.usedPorts.delete(session.relayPort);

        await new Promise<void>((resolve) => {
            session.server.close(() => resolve());
        });

        logger.info({
            action: 'container.port-proxy.session.closed',
            sessionId,
            relayPort: session.relayPort,
            teamId: session.teamId,
            containerId: session.containerId,
            privatePort: session.privatePort
        }, 'Closed container port proxy relay session');
    }

    private reservePort(): number {
        for (let port = this.portStart; port <= this.portEnd; port += 1) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }

        throw new Error('No available container app relay ports');
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }
}
