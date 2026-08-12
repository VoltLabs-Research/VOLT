import { ErrorCodes } from '@core/constants/error-codes';
import reverseWsHttpRelay from '@modules/cluster/services/reverse-channel/ReverseWsHttpRelay';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import containerPortProxyAccessTokenService from '@modules/container/services/ContainerPortProxyAccessTokenService';
import type { ContainerPortRelayTarget } from '@modules/container/services/ContainerPortProxyRelayService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import { buildWebSocketProtocolList } from '@shared/infrastructure/utilities/websocket-protocols';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';


const requireRelay = (relay: ContainerPortRelayTarget | undefined): ContainerPortRelayTarget => {
    if (!relay) {
        throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container public port relay was not found');
    }

    return relay;
};

const authorizeRelayRequest = (
    relay: ContainerPortRelayTarget,
    requestUrl: string,
    cookieHeader: string | undefined
): void => {
    const accessToken = containerPortProxyAccessTokenService.readFromRequest(requestUrl, cookieHeader);
    if (!accessToken) {
        throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Authentication is required');
    }

    const verifiedToken = containerPortProxyAccessTokenService.verify(accessToken);
    if (!verifiedToken) {
        throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'Your session is no longer valid');
    }

    if (
        verifiedToken.containerId !== relay.containerId
        || verifiedToken.privatePort !== relay.privatePort
        || verifiedToken.publicPort !== relay.publicPort
    ) {
        throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'You do not have access to this team');
    }
};

const writeRelayHttpError = (res: ServerResponse<IncomingMessage>, error: unknown): void => {
    if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined);
        return;
    }

    res.statusCode = error instanceof ApplicationError ? error.statusCode : 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Container app proxy failed'
    }));
};

const extractProxyTarget = (requestUrl: string): string => {
    const url = containerPortProxyAccessTokenService.stripFromUrl(requestUrl);
    const search = url.searchParams.toString();

    return `${url.pathname || '/'}${search ? `?${search}` : ''}`;
};

const rewriteLocationHeader = (location: string, relay: ContainerPortRelayTarget): string => {
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
};

const proxyHttpRequest = async (
    relay: ContainerPortRelayTarget,
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>
): Promise<void> => {
    const requestUrl = req.url || '/';
    const accessTokenFromUrl = containerPortProxyAccessTokenService.readFromUrl(requestUrl);

    const tunnel = await teamClusterDaemonClient.openTunnel(relay.teamClusterId, {
        targetHost: relay.internalIp,
        targetPort: relay.privatePort,
        accessMode: TeamClusterServiceExposureAccessMode.Http
    });
    const agent = reverseWsHttpRelay.createSingleUseTunnelHttpAgent(tunnel);

    reverseWsHttpRelay.proxyHttp({
        req,
        res,
        agent,
        upstreamOrigin: `http://${relay.internalIp}:${relay.privatePort}`,
        rewrittenUrl: extractProxyTarget(requestUrl),
        onProxyRes: (proxyResponse) => {
            const location = proxyResponse.headers.location;
            if (typeof location === 'string') {
                proxyResponse.headers.location = rewriteLocationHeader(location, relay);
            }

            if (accessTokenFromUrl) {
                proxyResponse.headers['set-cookie'] = containerPortProxyAccessTokenService.appendCookie(
                    proxyResponse.headers['set-cookie'],
                    accessTokenFromUrl
                );
            }
        },
        onSettled: () => {
            agent.destroy();
        },
        onError: (error) => {
            writeRelayHttpError(res, error);
        }
    });
};

export const serveRelayHttpRequest = async (
    relay: ContainerPortRelayTarget | undefined,
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>
): Promise<void> => {
    try {
        const authorizedRelay = requireRelay(relay);
        authorizeRelayRequest(authorizedRelay, req.url || '/', req.headers.cookie);
        await proxyHttpRequest(authorizedRelay, req, res);
    } catch (error: unknown) {
        writeRelayHttpError(res, error);
    }
};

export const serveRelayWebSocketUpgrade = async (
    relay: ContainerPortRelayTarget | undefined,
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
): Promise<void> => {
    try {
        const authorizedRelay = requireRelay(relay);
        authorizeRelayRequest(authorizedRelay, request.url || '/', request.headers.cookie);

        await reverseWsHttpRelay.proxyWebSocketUpgrade({
            teamClusterId: authorizedRelay.teamClusterId,
            request,
            socket,
            head,
            upstreamWebSocketUrl: `ws://${authorizedRelay.internalIp}:${authorizedRelay.privatePort}${extractProxyTarget(request.url || '/')}`,
            requestedProtocols: buildWebSocketProtocolList(request.headers['sec-websocket-protocol'])
        });
    } catch (error: unknown) {
        const statusCode = error instanceof ApplicationError ? error.statusCode : 500;
        const message = error instanceof Error ? error.message : 'WebSocket upgrade failed';
        writeUpgradeError(socket, statusCode, message);
    }
};
