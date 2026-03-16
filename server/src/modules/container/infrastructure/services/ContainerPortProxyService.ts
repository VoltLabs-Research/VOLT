import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'node:http';
import type { Request, Response } from 'express';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import type { Duplex } from 'node:stream';
import type { RawData } from 'ws';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { ContainerOwnershipService } from './ContainerOwnershipService';
import {
    buildContainerPortProxyBasePath,
    CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME,
    CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    ContainerPortProxyAccessTokenService,
    matchContainerPortProxyPath,
    readContainerPortProxyAccessTokenFromUrl
} from '@modules/container/infrastructure/utilities/container-port-proxy';

interface AuthorizedContainerPortProxyContext {
    teamId: string;
    containerId: string;
    privatePort: number;
    teamClusterId: string;
    runtimeContainerId: string;
    internalIp: string;
};

interface ProxyTarget {
    proxiedPath: string;
    rawQuery: string;
};

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

        cookies[key] = decodeURIComponent(rawValueParts.join('=').trim());
    }

    return cookies;
};

const writeUpgradeError = (socket: Duplex, statusCode: number, message: string): void => {
    socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

@injectable()
export class ContainerPortProxyService {
    private readonly webSocketServer = new WebSocketServer({
        noServer: true
    });

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(ContainerOwnershipService)
        private readonly ownershipService: ContainerOwnershipService,

        @inject(ContainerPortProxyAccessTokenService)
        private readonly accessTokenService: ContainerPortProxyAccessTokenService
    ) {}

    public proxyHttpRequest = async (req: Request, res: Response): Promise<void> => {
        try {
            const context = await this.authorizeProxyAccess(req.originalUrl, this.readHeaderValue(req.headers.cookie));
            this.persistAccessTokenCookie(req, res, context);
            const target = this.extractProxyTarget(req.originalUrl, context);
            const tunnel = await this.openContainerPortTunnel(context, TeamClusterServiceExposureAccessMode.Http);
            const upstreamAgent = this.createSingleUseTunnelHttpAgent(tunnel);
            const destroyUpstreamAgent = (): void => {
                upstreamAgent.destroy();
            };
            const upstreamRequest = http.request(this.buildUpstreamHttpRequestOptions(req, context, target, upstreamAgent), (upstreamResponse) => {
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
                if (!res.headersSent) {
                    BaseResponse.fromError(res, error);
                    return;
                }

                res.destroy(error);
            });

            this.writeProxyRequestBody(req, upstreamRequest);
        } catch (error: unknown) {
            BaseResponse.fromError(res, error);
        }
    };

    public isContainerPortUpgradeRequest(request: IncomingMessage): boolean {
        return (request.url || '').startsWith('/api/container-port-proxy/');
    }

    public handleUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
        if (!this.isContainerPortUpgradeRequest(request)) {
            return;
        }

        try {
            const context = await this.authorizeProxyAccess(request.url || '', this.readHeaderValue(request.headers.cookie));
            const target = this.extractProxyTarget(request.url || '', context);
            const tunnel = await this.openContainerPortTunnel(context, TeamClusterServiceExposureAccessMode.WebSocket);
            const upstreamWebSocket = new WebSocket(
                `ws://${context.internalIp}:${context.privatePort}${target.proxiedPath}${target.rawQuery}`,
                {
                    createConnection: () => tunnel,
                    headers: this.readUpgradeRequestHeaders(request, context)
                }
            );

            this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.bindWebSocketProxy(webSocket, upstreamWebSocket);
            });
        } catch (error: unknown) {
            const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
            const message = error instanceof Error ? error.message : 'WebSocket upgrade failed';
            writeUpgradeError(socket, statusCode, message);
        }
    };

    private async authorizeProxyAccess(
        requestUrl: string,
        cookieHeader: string | undefined
    ): Promise<AuthorizedContainerPortProxyContext> {
        const match = matchContainerPortProxyPath(requestUrl);
        if (!match) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container port proxy route not found');
        }

        const url = new URL(requestUrl, PROXY_URL_ORIGIN);
        const cookieToken = readCookies(cookieHeader)[CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME];
        const accessToken = url.searchParams.get(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM) || cookieToken;
        if (!accessToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        const verifiedToken = this.accessTokenService.verify(accessToken);
        if (!verifiedToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        }

        if (
            verifiedToken.teamId !== match.teamId
            || verifiedToken.containerId !== match.containerId
            || verifiedToken.privatePort !== match.privatePort
        ) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, ErrorCodes.TEAM_ACCESS_DENIED);
        }

        const container = await this.ownershipService.getOwnedByTeam(match.containerId, match.teamId);
        if (container.status !== 'running') {
            throw ApplicationError.conflict('Container::PortUnavailable', 'Container must be running to open this port');
        }

        const port = container.ports.find((item) => item.private === match.privatePort);
        if (!port) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container port is not exposed');
        }

        if (!container.teamCluster || !container.internalIp) {
            throw ApplicationError.conflict('Container::PortUnavailable', 'Container networking is not ready yet');
        }

        return {
            teamId: match.teamId,
            containerId: match.containerId,
            privatePort: match.privatePort,
            teamClusterId: container.teamCluster,
            runtimeContainerId: container.containerId,
            internalIp: container.internalIp
        };
    }

    private persistAccessTokenCookie(req: Request, res: Response, context: AuthorizedContainerPortProxyContext): void {
        const accessToken = readContainerPortProxyAccessTokenFromUrl(req.originalUrl);
        if (!accessToken) {
            return;
        }

        res.cookie(CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME, accessToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: buildContainerPortProxyBasePath(context.teamId, context.containerId, context.privatePort)
        });
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
        requestUrl: string,
        res: Response,
        headers: IncomingHttpHeaders,
        status: number,
        context: AuthorizedContainerPortProxyContext
    ): void {
        res.status(status);

        for (const [headerName, headerValue] of Object.entries(headers)) {
            if (typeof headerValue === 'undefined') {
                continue;
            }

            const normalizedHeaderName = headerName.toLowerCase();
            if (normalizedHeaderName === 'transfer-encoding' || normalizedHeaderName === 'content-encoding') {
                continue;
            }

            if (normalizedHeaderName === 'location') {
                res.setHeader(headerName, this.rewriteProxyLocation(this.readHeaderValue(headerValue) || '', requestUrl, context));
                continue;
            }

            res.setHeader(headerName, headerValue);
        }
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

    private async openContainerPortTunnel(
        context: AuthorizedContainerPortProxyContext,
        accessMode: TeamClusterServiceExposureAccessMode
    ): Promise<Duplex> {
        return this.teamClusterDaemonClient.openTunnel(context.teamClusterId, {
            targetHost: context.internalIp,
            targetPort: context.privatePort,
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
        context: AuthorizedContainerPortProxyContext,
        target: ProxyTarget,
        agent: http.Agent
    ): RequestOptions {
        const headers = this.readProxyRequestHeaders(req.headers);
        headers.host = `${context.internalIp}:${context.privatePort}`;

        return {
            protocol: 'http:',
            hostname: context.internalIp,
            host: context.internalIp,
            port: context.privatePort,
            method: req.method,
            path: `${target.proxiedPath}${target.rawQuery}`,
            headers,
            agent
        };
    }

    private writeProxyRequestBody(req: Request, upstreamRequest: http.ClientRequest): void {
        if (req.readable) {
            req.pipe(upstreamRequest);
            return;
        }

        if (req.body && typeof req.body === 'object') {
            upstreamRequest.end(JSON.stringify(req.body));
            return;
        }

        upstreamRequest.end();
    }

    private readUpgradeRequestHeaders(
        request: IncomingMessage,
        context: AuthorizedContainerPortProxyContext
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

        headers.host = `${context.internalIp}:${context.privatePort}`;

        return headers;
    }

    private extractProxyTarget(
        requestUrl: string,
        context: AuthorizedContainerPortProxyContext
    ): ProxyTarget {
        const url = new URL(requestUrl, PROXY_URL_ORIGIN);
        const publicProxyBasePath = buildContainerPortProxyBasePath(context.teamId, context.containerId, context.privatePort);
        const proxiedPath = this.normalizeUpstreamProxyPath(url.pathname, publicProxyBasePath);

        url.searchParams.delete(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM);

        const search = url.searchParams.toString();
        return {
            proxiedPath,
            rawQuery: search ? `?${search}` : ''
        };
    }

    private rewriteProxyLocation(
        requestLocation: string,
        requestUrl: string,
        context: AuthorizedContainerPortProxyContext
    ): string {
        const publicProxyBasePath = buildContainerPortProxyBasePath(context.teamId, context.containerId, context.privatePort);
        const requestUrlObject = new URL(requestUrl, PROXY_URL_ORIGIN);
        const currentProxyTarget = this.extractProxyTarget(requestUrl, context);
        const upstreamRequestUrl = new URL(`${currentProxyTarget.proxiedPath}${currentProxyTarget.rawQuery}`, UPSTREAM_URL_ORIGIN);
        const resolvedLocation = new URL(requestLocation, upstreamRequestUrl);
        const rewrittenUrl = new URL(PROXY_URL_ORIGIN);
        const normalizedPathname = this.normalizeUpstreamProxyPath(resolvedLocation.pathname, publicProxyBasePath);

        rewrittenUrl.pathname = normalizedPathname.startsWith(publicProxyBasePath)
            ? normalizedPathname
            : `${publicProxyBasePath}${normalizedPathname === '/' ? '' : normalizedPathname}`;
        rewrittenUrl.search = resolvedLocation.search;
        rewrittenUrl.hash = resolvedLocation.hash;

        const accessToken = requestUrlObject.searchParams.get(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM);
        if (accessToken && !rewrittenUrl.searchParams.has(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM)) {
            rewrittenUrl.searchParams.set(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM, accessToken);
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

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return value;
    }
}
