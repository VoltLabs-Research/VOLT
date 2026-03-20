import type { Duplex } from 'node:stream';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';

interface WebSocketBridgeOptions {
    upstreamErrorMessage: string;
};

interface WebSocketDuplexBridgeOptions {
    duplexCloseMessage: string;
    duplexEndMessage: string;
    duplexErrorMessage: string;
};

const isWebSocketOpen = (webSocket: WebSocket): boolean => webSocket.readyState === WebSocket.OPEN;

const safeSendWebSocket = (webSocket: WebSocket, payload: Buffer | string, isBinary: boolean): void => {
    if (!isWebSocketOpen(webSocket)) {
        return;
    }

    webSocket.send(payload, {
        binary: isBinary
    }, () => {
    });
};

const safeCloseWebSocket = (webSocket: WebSocket, code?: number, reason?: string): void => {
    if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
        return;
    }

    webSocket.close(code, reason);
};

/** Converts `ws` raw payloads into a sendable buffer or string. */
export const normalizeWebSocketPayload = (data: RawData): Buffer | string => {
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

/** Writes an HTTP upgrade failure response directly to the raw socket. */
export const writeUpgradeError = (socket: Duplex, statusCode: number, message: string): void => {
    if (socket.destroyed || socket.writableEnded) {
        return;
    }

    socket.end(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
};

/** Bridges two websocket endpoints without altering payloads or policies. */
export const bridgeWebSockets = (
    clientWebSocket: WebSocket,
    upstreamWebSocket: WebSocket,
    options: WebSocketBridgeOptions
): void => {
    upstreamWebSocket.on('message', (data, isBinary) => {
        const payload = normalizeWebSocketPayload(data);
        safeSendWebSocket(clientWebSocket, payload, isBinary);
    });
    upstreamWebSocket.on('close', (code, reason) => {
        safeCloseWebSocket(clientWebSocket, code || 1000, reason.toString() || undefined);
    });
    upstreamWebSocket.on('error', () => {
        safeCloseWebSocket(clientWebSocket, 1011, options.upstreamErrorMessage);
    });

    clientWebSocket.on('message', (data, isBinary) => {
        const payload = normalizeWebSocketPayload(data);
        safeSendWebSocket(upstreamWebSocket, payload, isBinary);
    });
    clientWebSocket.on('close', () => {
        safeCloseWebSocket(upstreamWebSocket);
    });
    clientWebSocket.on('error', () => {
        safeCloseWebSocket(upstreamWebSocket);
    });
};

/** Bridges a websocket endpoint to a raw duplex stream. */
export const bridgeWebSocketAndDuplex = (
    webSocket: WebSocket,
    duplex: Duplex,
    options: WebSocketDuplexBridgeOptions
): void => {
    duplex.on('data', (chunk: Buffer) => {
        safeSendWebSocket(webSocket, chunk, true);
    });
    duplex.on('close', () => {
        safeCloseWebSocket(webSocket, 1000, options.duplexCloseMessage);
    });
    duplex.on('end', () => {
        safeCloseWebSocket(webSocket, 1000, options.duplexEndMessage);
    });
    duplex.on('error', () => {
        safeCloseWebSocket(webSocket, 1011, options.duplexErrorMessage);
    });

    webSocket.on('message', (data) => {
        duplex.write(normalizeWebSocketPayload(data));
    });
    webSocket.on('close', () => {
        duplex.destroy();
    });
    webSocket.on('error', () => {
        duplex.destroy();
    });
};
