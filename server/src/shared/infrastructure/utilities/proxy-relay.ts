import type { Duplex } from 'node:stream';
import type { RawData } from 'ws';

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
