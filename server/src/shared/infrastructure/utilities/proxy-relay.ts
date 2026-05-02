import type { Duplex } from 'node:stream';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';

interface WebSocketDuplexBridgeOptions {
    duplexCloseMessage: string;
    duplexEndMessage: string;
    duplexErrorMessage: string;
}

const isWebSocketOpen = (webSocket: WebSocket): boolean => webSocket.readyState === WebSocket.OPEN;

const isSendableWebSocketCloseCode = (code: number): boolean => {
    if (code === 1000) {
        return true;
    }

    if (code >= 3000 && code <= 4999) {
        return true;
    }

    return code >= 1001
        && code <= 1014
        && code !== 1004
        && code !== 1005
        && code !== 1006;
};

export const normalizeWebSocketCloseCode = (code?: number): number | undefined => {
    if (typeof code !== 'number' || !Number.isInteger(code)) {
        return undefined;
    }

    return isSendableWebSocketCloseCode(code) ? code : 1000;
};

const safeSendWebSocket = (webSocket: WebSocket, payload: Buffer | string, isBinary: boolean): void => {
    if (!isWebSocketOpen(webSocket)) {
        return;
    }

    webSocket.send(payload, {
        binary: isBinary
    }, () => {});
};

const safeCloseWebSocket = (webSocket: WebSocket, code?: number, reason?: string): void => {
    if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
        return;
    }

    const normalizedCode = normalizeWebSocketCloseCode(code);
    if (normalizedCode === undefined) {
        webSocket.close();
        return;
    }

    webSocket.close(normalizedCode, reason);
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
