import logger from '@shared/infrastructure/logger';
import type { TeamClusterReverseWebSocketStream } from '@modules/cluster/services/TeamClusterReverseWebSocket';
import teamClusterReverseChannelService from '@modules/cluster/services/TeamClusterReverseChannelService';
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

interface ReverseWsHttpProxyOptions {
    req: IncomingMessage;
    res: ServerResponse;
    agent: http.Agent;
    upstreamOrigin: string;
    rewrittenUrl: string;
    requestBody?: Buffer;
    onProxyRes?: (proxyRes: IncomingMessage) => void;
    onSettled?: () => void;
    onError: (error: Error) => void;
}

interface ReverseWsWebSocketUpgradeOptions {
    teamClusterId: string;
    request: IncomingMessage;
    socket: Duplex;
    head: Buffer;
    upstreamWebSocketUrl: string;
    requestedProtocols?: string[];
}

class ReverseWsHttpRelay {
    createSingleUseTunnelHttpAgent(tunnel: Duplex): http.Agent {
        const agent = new http.Agent({
            keepAlive: false,
            maxSockets: 1
        });

        agent.createConnection = (): Duplex => tunnel;
        return agent;
    }

    proxyHttp(options: ReverseWsHttpProxyOptions): void {
        const proxy = httpProxy.createProxyServer();
        const originalUrl = options.req.url;
        let settled = false;

        const settle = (): void => {
            if (settled) {
                return;
            }

            settled = true;
            proxy.removeAllListeners();
            options.req.url = originalUrl;
            options.onSettled?.();
        };

        proxy.once('proxyReq', (proxyRequest) => {
            if (options.requestBody) {
                proxyRequest.setHeader('content-length', String(options.requestBody.length));
            }
        });

        proxy.once('proxyRes', (proxyResponse) => {
            options.onProxyRes?.(proxyResponse);
            proxyResponse.once('end', settle);
            proxyResponse.once('close', settle);
        });

        proxy.once('error', (error: Error) => {
            settle();
            options.onError(error);
        });

        options.req.once('aborted', settle);
        options.res.once('close', settle);

        options.req.url = options.rewrittenUrl;
        proxy.web(options.req, options.res, {
            target: options.upstreamOrigin,
            agent: options.agent,
            changeOrigin: true,
            xfwd: true,
            buffer: options.requestBody ? Readable.from(options.requestBody) : undefined
        });
    }

    async proxyWebSocketUpgrade(options: ReverseWsWebSocketUpgradeOptions): Promise<void> {
        const upstreamWebSocket = await teamClusterReverseChannelService.attachWebSocket(
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

export default new ReverseWsHttpRelay();
