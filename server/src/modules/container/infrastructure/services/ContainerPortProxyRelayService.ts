import { ErrorCodes } from '@core/constants/error-codes';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { IContainerPortProxyRelayService } from '@modules/container/domain/port/IContainerPortProxyRelayService';
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
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import {
    readRelayHostValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import httpProxy from 'http-proxy';
import type {
    IncomingMessage,
    ServerResponse
} from 'node:http';
import http from 'node:http';
import type { Duplex } from 'node:stream';

interface ContainerPortRelayTarget {
    teamId: string;
    containerId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
    publicPort: number;
}

interface CreateContainerPortAccessUrlInput extends ContainerPortRelayTarget {
    userId: string;
}

interface ContainerPortProxyRelay extends ContainerPortRelayTarget {
    server: http.Server;
}

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
}

const DEFAULT_RELAY_BIND_HOST = '0.0.0.0';
const PROXY_URL_ORIGIN = 'http://volt.local';

const readCookies = (rawCookieHeader?: string): Record<string, string | undefined> => {
    if (!rawCookieHeader) {
        return {};
    }

    return parseCookie(rawCookieHeader);
};

@Singleton(CONTAINER_TOKENS.ContainerPortProxyRelayService)
export class ContainerPortProxyRelayService implements IContainerPortProxyRelayService {
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost, 'TEAM_CLUSTER_APP_PROXY_ADVERTISED_HOST');
    private readonly publicProtocol = resolveContainerPortProxyRelayProtocol();
    private readonly relaysByPublicPort = new Map<number, ContainerPortProxyRelay>();

    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly accessTokenService: ContainerPortProxyAccessTokenService
    ) {}

    async createAccessUrl(input: CreateContainerPortAccessUrlInput): Promise<{ url: string; expiresAt: string; }> {
        await this.ensureRelay(input);

        const expiresAt = Date.now() + this.accessTokenService.getTtlMs();
        const url = buildContainerPortProxyRelayUrl({
            containerId: input.containerId,
            privatePort: input.privatePort,
            publicPort: input.publicPort,
            userId: input.userId,
            advertisedHost: this.advertisedHost,
            protocol: this.publicProtocol,
            createAccessToken: this.accessTokenService.create.bind(this.accessTokenService)
        });

        return {
            url,
            expiresAt: new Date(expiresAt).toISOString()
        };
    }

    async ensureContainerRelays(relays: ContainerPortRelayTarget[]): Promise<void> {
        await Promise.all(relays.map((relay) => this.ensureRelay(relay)));
    }

    async syncContainerRelays(containerId: string, relays: ContainerPortRelayTarget[]): Promise<void> {
        const nextPublicPorts = new Set(relays.map((relay) => relay.publicPort));
        const staleRelays = Array.from(this.relaysByPublicPort.values()).filter((relay) => {
            return relay.containerId === containerId && !nextPublicPorts.has(relay.publicPort);
        });

        await Promise.all(staleRelays.map((relay) => this.stopRelay(relay.publicPort)));
        await this.ensureContainerRelays(relays);
    }

    async stopContainerRelays(containerId: string): Promise<void> {
        const publicPorts = Array.from(this.relaysByPublicPort.values())
            .filter((relay) => relay.containerId === containerId)
            .map((relay) => relay.publicPort);

        await Promise.all(publicPorts.map((publicPort) => this.stopRelay(publicPort)));
    }

    async stopPublicPortRelays(publicPorts: number[]): Promise<void> {
        await Promise.all(publicPorts.map((publicPort) => this.stopRelay(publicPort)));
    }

    async stopAll(): Promise<void> {
        await Promise.all(Array.from(this.relaysByPublicPort.keys()).map((publicPort) => this.stopRelay(publicPort)));
    }

    private async ensureRelay(input: ContainerPortRelayTarget): Promise<void> {
        const existingRelay = this.relaysByPublicPort.get(input.publicPort);

        if (existingRelay) {
            if (existingRelay.containerId !== input.containerId || existingRelay.privatePort !== input.privatePort) {
                throw ApplicationError.conflict(
                    'Container::PublicPortUnavailable',
                    `Public port ${input.publicPort} is already assigned to another container port`
                );
            }

            Object.assign(existingRelay, input);
            return;
        }

        const server = http.createServer((req, res) => {
            this.handleHttpRequest(input.publicPort, req, res).catch((error: unknown) => {
                this.writeHttpError(res, error);
            });
        });

        server.on('upgrade', (request, socket, head) => {
            this.handleUpgrade(input.publicPort, request, socket, head).catch((error: unknown) => {
                const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
                const message = error instanceof Error ? error.message : 'WebSocket upgrade failed';
                writeUpgradeError(socket, statusCode, message);
            });
        });

        await this.listen(server, input.publicPort);

        this.relaysByPublicPort.set(input.publicPort, {
            ...input,
            server
        });

        logger.info(`Started container public port relay publicPort=${input.publicPort} teamId=${input.teamId} containerId=${input.containerId}`);
    }

    private async listen(server: http.Server, publicPort: number): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            let bound = false;

            const cleanup = (): void => {
                server.off('error', onError);
                server.off('listening', onListening);
            };

            const onListening = (): void => {
                bound = true;
                cleanup();
                resolve();
            };

            const onError = (error: Error): void => {
                cleanup();
                if (!bound && server.listening) {
                    server.close();
                }
                reject(error);
            };

            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(publicPort, this.bindHost);
        });
    }

    private async handleHttpRequest(
        publicPort: number,
        req: IncomingMessage,
        res: ServerResponse<IncomingMessage>
    ): Promise<void> {
        const relay = this.requireAuthorizedRelay(publicPort, req.url || '/', this.readHeaderValue(req.headers.cookie));
        const accessTokenFromUrl = readContainerPortProxyAccessTokenFromUrl(req.url || '/');

        const target = this.extractProxyTarget(req.url || '/');
        const tunnel = await this.teamClusterDaemonClient.openTunnel(relay.teamClusterId, {
            targetHost: relay.internalIp,
            targetPort: relay.privatePort,
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
                proxyResponse.headers.location = this.rewriteLocationHeader(location, relay);
            }

            if (accessTokenFromUrl) {
                proxyResponse.headers['set-cookie'] = this.appendAccessTokenCookie(
                    proxyResponse.headers['set-cookie'],
                    accessTokenFromUrl
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
            target: `http://${relay.internalIp}:${relay.privatePort}`,
            agent,
            changeOrigin: true,
            xfwd: true
        });
        req.url = originalUrl;
    }

    private async handleUpgrade(publicPort: number, request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const relay = this.requireAuthorizedRelay(publicPort, request.url || '/', this.readHeaderValue(request.headers.cookie));
        const target = this.extractProxyTarget(request.url || '/');
        const tunnel = await this.teamClusterDaemonClient.openTunnel(relay.teamClusterId, {
            targetHost: relay.internalIp,
            targetPort: relay.privatePort,
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
            target: `ws://${relay.internalIp}:${relay.privatePort}`,
            agent,
            changeOrigin: true,
            xfwd: true
        });
        request.url = originalUrl;
    }

    private requireAuthorizedRelay(
        publicPort: number,
        requestUrl: string,
        cookieHeader: string | undefined
    ): ContainerPortProxyRelay {
        const relay = this.relaysByPublicPort.get(publicPort);
        if (!relay) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container public port relay was not found');
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
            verifiedToken.containerId !== relay.containerId
            || verifiedToken.privatePort !== relay.privatePort
            || verifiedToken.publicPort !== relay.publicPort
        ) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, ErrorCodes.TEAM_ACCESS_DENIED);
        }

        return relay;
    }

    private appendAccessTokenCookie(
        existing: string | string[] | undefined,
        accessToken: string
    ): string[] {
        const ourCookie = serializeCookie(CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME, accessToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: Math.max(1, Math.floor(this.accessTokenService.getTtlMs() / 1000))
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

    private rewriteLocationHeader(location: string, relay: ContainerPortProxyRelay): string {
        if (!location) {
            return location;
        }

        try {
            const resolvedLocation = new URL(location, `http://${relay.internalIp}:${relay.privatePort}/`);
            if (
                resolvedLocation.hostname === relay.internalIp
                && Number(resolvedLocation.port || '80') === relay.privatePort
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

    private async stopRelay(publicPort: number): Promise<void> {
        const relay = this.relaysByPublicPort.get(publicPort);
        if (!relay) {
            return;
        }

        this.relaysByPublicPort.delete(publicPort);

        await new Promise<void>((resolve) => {
            relay.server.close(() => resolve());
        });

        logger.info(`Stopped container public port relay publicPort=${publicPort} teamId=${relay.teamId} containerId=${relay.containerId}`);
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }
}
