import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import type { TeamClusterReverseWebSocketStream } from '@modules/cluster/utilities/teamClusterReverseWebSocket';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import {
    normalizeWebSocketCloseCode,
    normalizeWebSocketPayload,
    writeUpgradeError
} from '@shared/infrastructure/utilities/proxy-relay';
import httpProxy from 'http-proxy';
import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import { Duplex, Readable } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';

/** Reason an in-flight HTTP proxy exchange settled, used to derive cleanup intent. */
export type ReverseWsHttpRelaySettleReason = 'end' | 'close' | 'error' | 'aborted';

export interface ReverseWsHttpProxyOptions {
    /** The inbound client request. Its `url` is swapped to `rewrittenUrl` for the upstream and restored on settle. */
    req: IncomingMessage;
    /** The outbound client response. */
    res: ServerResponse;
    /**
     * HTTP agent whose `createConnection` returns the reverse-channel tunnel duplex.
     * Lifecycle (single-use vs pooled) is owned by the caller — this relay never destroys it.
     */
    agent: http.Agent;
    /** Upstream origin, e.g. `http://<tunnelHost>:<tunnelPort>`. */
    upstreamOrigin: string;
    /** Path + query to send upstream (already stripped of the access token, native auth injected, etc.). */
    rewrittenUrl: string;
    /** Optional buffered request body (used when the body was already consumed upstream). */
    requestBody?: Buffer;
    /** Mutate upstream response headers before they reach the client (CSP/location/cookie rewriting). */
    onProxyRes?: (proxyRes: IncomingMessage) => void;
    /**
     * Called exactly once when the exchange settles. `destroy` is the derived
     * cleanup intent (true when the tunnel/session should be torn down). The
     * caller frees its agent/session here.
     */
    onSettled?: (destroy: boolean, reason: ReverseWsHttpRelaySettleReason) => void;
    /** Called on proxy error after settling. The caller writes the error response. */
    onError: (error: Error) => void;
}

export interface ReverseWsWebSocketUpgradeOptions {
    teamClusterId: string;
    request: IncomingMessage;
    socket: Duplex;
    head: Buffer;
    /** Upstream websocket URL, e.g. `ws://<tunnelHost>:<tunnelPort><path><query>`. */
    upstreamWebSocketUrl: string;
    requestedProtocols?: string[];
}

/**
 * Shared reverse-WS HTTP/WebSocket relay mechanics.
 *
 * Owns the transport plumbing duplicated between the container "Open :PORT"
 * proxy and the Jupyter scripting proxy:
 *  - HTTP: `httpProxy.web` with request-url swap, proxyReq/proxyRes/error/abort
 *    wiring, and a single-settle guard.
 *  - WebSocket: the daemon `attachWebSocket` mechanism — the daemon terminates
 *    the upstream socket and relays frames over the reverse channel, bridged to
 *    the client via `ws.WebSocketServer` (noServer).
 *
 * Policy (agent pooling, header rewriting, upstream auth injection, target
 * resolution) stays in the callers via the options/hooks above. This keeps the
 * single behavioral path for the delicate Jupyter kernel websocket while letting
 * the container proxy share it.
 */
@Singleton()
export class ReverseWsHttpRelay {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    /** Builds an HTTP agent whose single connection IS the provided reverse-channel tunnel duplex. */
    createSingleUseTunnelHttpAgent(tunnel: Duplex): http.Agent {
        const agent = new http.Agent({
            keepAlive: false,
            maxSockets: 1
        });

        agent.createConnection = (): Duplex => tunnel;
        return agent;
    }

    /** Proxies an HTTP request to the upstream over the caller-provided tunnel agent. */
    proxyHttp(options: ReverseWsHttpProxyOptions): void {
        const proxy = httpProxy.createProxyServer();
        const originalUrl = options.req.url;
        let settled = false;

        const settle = (destroy: boolean, reason: ReverseWsHttpRelaySettleReason): void => {
            if (settled) {
                return;
            }

            settled = true;
            proxy.removeAllListeners();
            options.req.url = originalUrl;
            options.onSettled?.(destroy, reason);
        };

        proxy.once('proxyReq', (proxyRequest) => {
            if (options.requestBody) {
                proxyRequest.setHeader('content-length', String(options.requestBody.length));
            }
        });

        proxy.once('proxyRes', (proxyResponse) => {
            options.onProxyRes?.(proxyResponse);
            proxyResponse.once('end', () => settle(false, 'end'));
            proxyResponse.once('close', () => settle(!options.res.writableEnded, 'close'));
        });

        proxy.once('error', (error: Error) => {
            settle(true, 'error');
            options.onError(error);
        });

        options.req.once('aborted', () => settle(true, 'aborted'));
        options.res.once('close', () => settle(!options.res.writableEnded, 'close'));

        options.req.url = options.rewrittenUrl;
        proxy.web(options.req, options.res, {
            target: options.upstreamOrigin,
            agent: options.agent,
            changeOrigin: true,
            xfwd: true,
            buffer: options.requestBody ? Readable.from(options.requestBody) : undefined
        });
    }

    /**
     * Completes a client websocket upgrade by attaching an upstream websocket on
     * the daemon (which terminates it and relays frames over the reverse channel)
     * and bridging the two. Errors before the client handshake are written to the
     * raw socket; the caller only needs to handle authorization/target resolution.
     */
    async proxyWebSocketUpgrade(options: ReverseWsWebSocketUpgradeOptions): Promise<void> {
        const upstreamWebSocket = await this.teamClusterDaemonClient.attachWebSocket(
            options.teamClusterId,
            options.upstreamWebSocketUrl,
            options.requestedProtocols
        );
        const negotiatedProtocol = upstreamWebSocket.protocol || undefined;
        let upgradeSettled = false;

        const cleanupPendingUpgrade = (): void => {
            upstreamWebSocket.removeAllListeners('error');
            upstreamWebSocket.removeAllListeners('end');
            options.socket.off('close', onClientSocketCloseBeforeReady);
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

            logger.warn(`Reverse-WS websocket upgrade failed before client handshake statusCode=${statusCode} upstreamError=${error?.message}`);

            upstreamWebSocket.destroy();
            writeUpgradeError(options.socket, statusCode, message);
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
        options.socket.once('close', onClientSocketCloseBeforeReady);

        this.completeClientWebSocketUpgrade(options.request, options.socket, options.head, (webSocket) => {
            if (!finalizePendingUpgrade()) {
                webSocket.close(1011, 'WebSocket upgrade already settled');
                return;
            }

            this.bindReverseChannelWebSocketProxy(webSocket, upstreamWebSocket);
        }, negotiatedProtocol);
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

    private bindReverseChannelWebSocketProxy(
        webSocket: WebSocket,
        upstreamWebSocket: TeamClusterReverseWebSocketStream
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
            if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
                return;
            }

            const normalizedCloseCode = normalizeWebSocketCloseCode(code);
            if (normalizedCloseCode === undefined) {
                webSocket.close();
                return;
            }

            webSocket.close(normalizedCloseCode, message || undefined);
        });
        upstreamWebSocket.on('error', (error) => {
            logger.warn(`Reverse-channel websocket failed upstreamError=${error.message}`);

            if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
                return;
            }

            webSocket.close(1011, 'Remote websocket failed');
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
}
