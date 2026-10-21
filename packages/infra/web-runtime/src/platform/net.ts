// Node's `net`: address helpers, and TCP connections only to loopback ports, which are the loopback
// network's http connections; there is no raw TCP in a browser.
import { EventEmitter } from 'events';

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(([0-9a-f]{1,4}:){0,7}[0-9a-f]{0,4})?::(([0-9a-f]{1,4}:){0,7}[0-9a-f]{0,4})?)$/i;

export const isIPv4 = (input: string): boolean => IPV4.test(input);

export const isIPv6 = (input: string): boolean => IPV6.test(input.replace(/%.*$/, ''));

export const isIP = (input: string): 0 | 4 | 6 => isIPv4(input) ? 4 : isIPv6(input) ? 6 : 0;

export const unsupported = (operation: string): Error => (
    Object.assign(new Error(`${operation}: raw TCP sockets are not available in the browser`), { code: 'ENOTSUP' })
);

export class Socket extends EventEmitter {
    connect(): this {
        queueMicrotask(() => this.emit('error', unsupported('net.Socket.connect')));
        return this;
    }

    write(): boolean { return false; }
    end(): this { return this; }
    destroy(): this { return this; }
    setTimeout(): this { return this; }
    setNoDelay(): this { return this; }
    setKeepAlive(): this { return this; }
    ref(): this { return this; }
    unref(): this { return this; }
}

export const createConnection = (): Socket => new Socket().connect();

export const connect = createConnection;

export const createServer = (): never => {
    throw unsupported('net.createServer');
};

export default { isIP, isIPv4, isIPv6, Socket, createConnection, connect, createServer };
