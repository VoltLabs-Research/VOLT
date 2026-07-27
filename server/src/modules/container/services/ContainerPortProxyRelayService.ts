import { ErrorCodes } from '@core/constants/error-codes';
import reverseWsHttpRelay from '@modules/cluster/services/ReverseWsHttpRelay';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import {
    readRelayHostValue,
    resolveRelayAdvertisedHost
} from '@shared/infrastructure/utilities/relay-network';
import { buildWebSocketProtocolList } from '@shared/infrastructure/utilities/websocket-protocols';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import type {
    IncomingMessage,
    ServerResponse
} from 'node:http';
import http from 'node:http';
import type { Duplex } from 'node:stream';

interface ContainerPortProxyAccessTokenSignOptions extends SignOptions {
    expiresIn: number;
}

interface ContainerPortProxyAccessTokenContext {
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

interface BuildContainerPortProxyRelayUrlInput extends ContainerPortProxyAccessTokenContext {
    advertisedHost: string;
    protocol: 'http' | 'https';
    createAccessToken: (input: ContainerPortProxyAccessTokenContext) => string;
}

interface ContainerPortProxyAccessTokenClaims extends JwtPayload {
    type: 'container-port-proxy';
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

export interface VerifiedContainerPortProxyAccessToken {
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

export const CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM = 'access_token';
export const CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME = 'voltContainerPortProxyAccessToken';

const DEFAULT_CONTAINER_PORT_PROXY_SESSION_TTL_MS = 600_000;
const RELAY_URL_ORIGIN = 'http://volt.local';

const getSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error('SECRET_KEY is required');
    }

    return key;
};

const isClaimsPayload = (value: unknown): value is ContainerPortProxyAccessTokenClaims => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    return payload.type === 'container-port-proxy'
        && typeof payload.containerId === 'string'
        && typeof payload.privatePort === 'number'
        && typeof payload.publicPort === 'number'
        && typeof payload.userId === 'string';
};

export const resolveContainerPortProxyRelayProtocol = (): 'http' | 'https' => {
    const configuredProtocol = process.env.TEAM_CLUSTER_APP_PROXY_PROTOCOL?.trim();
    if (configuredProtocol === 'http' || configuredProtocol === 'https') {
        return configuredProtocol;
    }

    const configuredServerEndpoint = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerEndpoint) {
        try {
            const protocol = new URL(configuredServerEndpoint).protocol.replace(':', '');
            if (protocol === 'http' || protocol === 'https') {
                return protocol;
            }
        } catch {
        }
    }

    const schema = process.env.SERVER_SCHEMA?.trim();
    return schema === 'https' ? 'https' : 'http';
};

export const buildContainerPortProxyRelayUrl = (input: BuildContainerPortProxyRelayUrlInput): string => {
    const accessToken = input.createAccessToken({
        containerId: input.containerId,
        privatePort: input.privatePort,
        publicPort: input.publicPort,
        userId: input.userId
    });
    const relayUrl = new URL(`${input.protocol}://${input.advertisedHost}:${input.publicPort}/`);
    relayUrl.searchParams.set(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM, accessToken);
    return relayUrl.toString();
};

export const readContainerPortProxyAccessTokenFromUrl = (requestUrl: string): string | null => {
    const url = new URL(requestUrl, RELAY_URL_ORIGIN);
    return url.searchParams.get(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM);
};

export class ContainerPortProxyAccessTokenService {
    private readonly secret = getSecretKey();
    private readonly signOptions: ContainerPortProxyAccessTokenSignOptions = {
        expiresIn: Math.ceil(
            readPositiveIntegerEnv(
                'CONTAINER_PORT_PROXY_SESSION_TTL_MS',
                DEFAULT_CONTAINER_PORT_PROXY_SESSION_TTL_MS
            ) / 1000
        )
    };

    create(input: ContainerPortProxyAccessTokenContext): string {
        return jwt.sign({
            type: 'container-port-proxy',
            containerId: input.containerId,
            privatePort: input.privatePort,
            publicPort: input.publicPort,
            userId: input.userId
        }, this.secret, this.signOptions);
    }

    verify(token: string): VerifiedContainerPortProxyAccessToken | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            if (!isClaimsPayload(decoded)) {
                return null;
            }

            return {
                containerId: decoded.containerId,
                privatePort: decoded.privatePort,
                publicPort: decoded.publicPort,
                userId: decoded.userId
            };
        } catch {
            return null;
        }
    }

    getTtlMs(): number {
        return readPositiveIntegerEnv(
            'CONTAINER_PORT_PROXY_SESSION_TTL_MS',
            DEFAULT_CONTAINER_PORT_PROXY_SESSION_TTL_MS
        );
    }
}

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

export class ContainerPortProxyRelayService {
    private readonly bindHost = readRelayHostValue('TEAM_CLUSTER_APP_PROXY_BIND_HOST', DEFAULT_RELAY_BIND_HOST);
    private readonly advertisedHost = resolveRelayAdvertisedHost(this.bindHost, 'TEAM_CLUSTER_APP_PROXY_ADVERTISED_HOST');
    private readonly publicProtocol = resolveContainerPortProxyRelayProtocol();
    private readonly relaysByPublicPort = new Map<number, ContainerPortProxyRelay>();
    private readonly accessTokenService: ContainerPortProxyAccessTokenService = new ContainerPortProxyAccessTokenService();

    private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    private readonly reverseWsHttpRelay = reverseWsHttpRelay;

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
        const agent = this.reverseWsHttpRelay.createSingleUseTunnelHttpAgent(tunnel);

        this.reverseWsHttpRelay.proxyHttp({
            req,
            res,
            agent,
            upstreamOrigin: `http://${relay.internalIp}:${relay.privatePort}`,
            rewrittenUrl: `${target.proxiedPath}${target.rawQuery}`,
            onProxyRes: (proxyResponse) => {
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
            },
            onSettled: () => {
                agent.destroy();
            },
            onError: (error) => {
                if (!res.headersSent) {
                    this.writeHttpError(res, error);
                    return;
                }

                res.destroy(error);
            }
        });
    }

    private async handleUpgrade(publicPort: number, request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const relay = this.requireAuthorizedRelay(publicPort, request.url || '/', this.readHeaderValue(request.headers.cookie));
        const target = this.extractProxyTarget(request.url || '/');
        const requestedProtocols = buildWebSocketProtocolList(request.headers['sec-websocket-protocol']);

        await this.reverseWsHttpRelay.proxyWebSocketUpgrade({
            teamClusterId: relay.teamClusterId,
            request,
            socket,
            head,
            upstreamWebSocketUrl: `ws://${relay.internalIp}:${relay.privatePort}${target.proxiedPath}${target.rawQuery}`,
            requestedProtocols
        });
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

export default new ContainerPortProxyRelayService();
