// Node's `http2`: its constants and default settings, which libraries read when they load (grpc-js,
// for dockerode's BuildKit sessions). HTTP/2 runs over TCP, so sessions fail to connect as net does.
import { EventEmitter } from 'events';
import { unsupported } from './net';

// Defined by scripts/build.mjs from the Node that builds the bundle.
declare const VOLT_HTTP2_CONSTANTS: Record<string, string | number>;
declare const VOLT_HTTP2_DEFAULT_SETTINGS: Record<string, number | boolean>;

export const constants = VOLT_HTTP2_CONSTANTS;

export const getDefaultSettings = (): Record<string, number | boolean> => ({ ...VOLT_HTTP2_DEFAULT_SETTINGS });

class Http2Session extends EventEmitter {
    closed = false;
    destroyed = false;

    request(): never {
        throw unsupported('http2 request');
    }

    settings(): void {}
    ping(): boolean { return false; }
    close(): void {
        this.closed = true;
    }
    destroy(): void {
        this.destroyed = true;
    }
    ref(): void {}
    unref(): void {}
}

export const connect = (): Http2Session => {
    const session = new Http2Session();
    queueMicrotask(() => session.emit('error', unsupported('http2.connect')));
    return session;
};

export const createServer = (): never => {
    throw unsupported('http2.createServer');
};

export const createSecureServer = (): never => {
    throw unsupported('http2.createSecureServer');
};

export default { constants, getDefaultSettings, connect, createServer, createSecureServer };
