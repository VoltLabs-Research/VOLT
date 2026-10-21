// Node's `http` module over the loopback network: `createServer().listen(port)` accepts loopback
// connections, and `http.request` to a loopback host opens one. Express, engine.io and the object
// gateway client see the same objects they get from Node.
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import {
    closeLoopback,
    connectLoopback,
    isLoopbackHost,
    listenLoopback
} from './loopback';
import type {
    LoopbackChannelMessage,
    LoopbackConnection,
    LoopbackRequestHead
} from './loopback';

export const METHODS = ['ACL', 'BIND', 'CHECKOUT', 'CONNECT', 'COPY', 'DELETE', 'GET', 'HEAD', 'LINK', 'LOCK', 'M-SEARCH', 'MERGE', 'MKACTIVITY', 'MKCALENDAR', 'MKCOL', 'MOVE', 'NOTIFY', 'OPTIONS', 'PATCH', 'POST', 'PROPFIND', 'PROPPATCH', 'PURGE', 'PUT', 'QUERY', 'REBIND', 'REPORT', 'SEARCH', 'SOURCE', 'SUBSCRIBE', 'TRACE', 'UNBIND', 'UNLINK', 'UNLOCK', 'UNSUBSCRIBE'];

export const STATUS_CODES: Record<number, string> = {
    100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified',
    307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized',
    402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable',
    408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed',
    413: 'Payload Too Large', 415: 'Unsupported Media Type', 416: 'Range Not Satisfiable', 422: 'Unprocessable Entity',
    423: 'Locked', 425: 'Too Early', 426: 'Upgrade Required', 428: 'Precondition Required', 429: 'Too Many Requests',
    431: 'Request Header Fields Too Large', 500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
    503: 'Service Unavailable', 504: 'Gateway Timeout', 507: 'Insufficient Storage'
};

type HeaderValue = string | string[] | number;

const encoder = new TextEncoder();

const toBytes = (chunk: unknown, encoding?: BufferEncoding): Uint8Array => {
    if(typeof chunk === 'string'){
        return encoding && encoding !== 'utf8' && encoding !== 'utf-8'
            ? Uint8Array.from(Buffer.from(chunk, encoding))
            : encoder.encode(chunk);
    }
    if(chunk instanceof Uint8Array){
        return chunk;
    }
    if(chunk instanceof ArrayBuffer){
        return new Uint8Array(chunk);
    }
    throw new TypeError('The "chunk" argument must be of type string or an instance of Buffer or Uint8Array');
};

const post = (channel: MessagePort, message: LoopbackChannelMessage): void => {
    if(message.type === 'data'){
        // Copied so the sender may reuse its buffer; the copy is transferred, not cloned again.
        const chunk = message.chunk.slice();
        channel.postMessage({ type: 'data', chunk }, [chunk.buffer]);
        return;
    }
    channel.postMessage(message);
};

// What req.socket / res.socket are: there is no TCP connection, but middleware reads the peer
// address and on-finished listens for the socket closing.
export class LoopbackSocket extends EventEmitter {
    readonly remoteAddress = '127.0.0.1';
    readonly remotePort = 0;
    readonly localAddress = '127.0.0.1';
    readonly encrypted = false;
    readable = true;
    writable = true;
    destroyed = false;

    setTimeout(): this { return this; }
    setNoDelay(): this { return this; }
    setKeepAlive(): this { return this; }
    ref(): this { return this; }
    unref(): this { return this; }
    address(): { address: string; family: string; port: number } {
        return { address: '127.0.0.1', family: 'IPv4', port: 0 };
    }

    destroy(error?: Error): this {
        if(this.destroyed){
            return this;
        }
        this.destroyed = true;
        this.readable = false;
        this.writable = false;
        if(error){
            this.emit('error', error);
        }
        this.emit('close', Boolean(error));
        return this;
    }

    end(): this {
        return this.destroy();
    }
}

const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
    const normalized: Record<string, string> = {};
    for(const [name, value] of Object.entries(headers)){
        normalized[name.toLowerCase()] = value;
    }
    return normalized;
};

export class IncomingMessage extends Readable {
    method?: string;
    url?: string;
    statusCode?: number;
    statusMessage?: string;
    headers: Record<string, string | string[]> = {};
    rawHeaders: string[] = [];
    trailers: Record<string, string> = {};
    rawTrailers: string[] = [];
    httpVersion = '1.1';
    httpVersionMajor = 1;
    httpVersionMinor = 1;
    complete = false;
    aborted = false;
    socket: LoopbackSocket;
    connection: LoopbackSocket;

    constructor(socket: LoopbackSocket){
        super({ read(){} });
        this.socket = socket;
        this.connection = socket;
    }

    setHeaders(headers: Record<string, string | string[]>): void {
        this.headers = headers;
        this.rawHeaders = Object.entries(headers).flatMap(([name, value]) => (
            Array.isArray(value) ? value.flatMap((item) => [name, item]) : [name, value]
        ));
    }

    setTimeout(): this {
        return this;
    }

    pushChunk(chunk: Uint8Array): void {
        this.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    }

    finish(): void {
        this.complete = true;
        this.push(null);
    }
}

// Shared header bookkeeping of ServerResponse and ClientRequest, as in Node's OutgoingMessage.
export class OutgoingMessage extends Writable {
    protected readonly outgoingHeaders = new Map<string, { name: string; value: HeaderValue }>();
    headersSent = false;
    finished = false;
    sendDate = false;
    chunkedEncoding = false;
    useChunkedEncodingByDefault = true;

    setHeader(name: string, value: HeaderValue): this {
        if(this.headersSent){
            throw Object.assign(new Error('Cannot set headers after they are sent to the client'), { code: 'ERR_HTTP_HEADERS_SENT' });
        }
        this.outgoingHeaders.set(name.toLowerCase(), { name, value });
        return this;
    }

    appendHeader(name: string, value: HeaderValue): this {
        const current = this.getHeader(name);
        if(current === undefined){
            return this.setHeader(name, value);
        }
        const values = [...(Array.isArray(current) ? current : [String(current)]), ...(Array.isArray(value) ? value : [String(value)])];
        return this.setHeader(name, values);
    }

    getHeader(name: string): HeaderValue | undefined {
        return this.outgoingHeaders.get(name.toLowerCase())?.value;
    }

    getHeaders(): Record<string, HeaderValue> {
        return Object.fromEntries([...this.outgoingHeaders].map(([key, { value }]) => [key, value]));
    }

    getHeaderNames(): string[] {
        return [...this.outgoingHeaders.keys()];
    }

    getRawHeaderNames(): string[] {
        return [...this.outgoingHeaders.values()].map(({ name }) => name);
    }

    hasHeader(name: string): boolean {
        return this.outgoingHeaders.has(name.toLowerCase());
    }

    removeHeader(name: string): void {
        this.outgoingHeaders.delete(name.toLowerCase());
    }

    flushHeaders(): void {}

    protected serializeHeaders(): Record<string, string | string[]> {
        const headers: Record<string, string | string[]> = {};
        for(const [key, { value }] of this.outgoingHeaders){
            headers[key] = Array.isArray(value) ? value.map(String) : String(value);
        }
        return headers;
    }
}

export class ServerResponse extends OutgoingMessage {
    statusCode = 200;
    statusMessage = '';
    readonly req: IncomingMessage;
    readonly socket: LoopbackSocket;
    readonly connection: LoopbackSocket;
    private readonly channel: MessagePort;

    constructor(req: IncomingMessage, channel: MessagePort){
        super();
        this.req = req;
        this.socket = req.socket;
        this.connection = req.socket;
        this.channel = channel;
        this.once('finish', () => {
            this.finished = true;
            post(this.channel, { type: 'end' });
            this.channel.close();
            this.socket.destroy();
        });
    }

    writeHead(statusCode: number, statusMessageOrHeaders?: string | Record<string, HeaderValue> | HeaderValue[], maybeHeaders?: Record<string, HeaderValue>): this {
        this.statusCode = statusCode;
        const headers = typeof statusMessageOrHeaders === 'string' ? maybeHeaders : statusMessageOrHeaders;
        if(typeof statusMessageOrHeaders === 'string'){
            this.statusMessage = statusMessageOrHeaders;
        }
        if(Array.isArray(headers)){
            for(let index = 0; index < headers.length; index += 2){
                this.setHeader(String(headers[index]), headers[index + 1]);
            }
        }else if(headers){
            for(const [name, value] of Object.entries(headers)){
                this.setHeader(name, value);
            }
        }
        this.sendHead();
        return this;
    }

    writeContinue(): void {}

    writeProcessing(): void {}

    addTrailers(): void {}

    override flushHeaders(): void {
        this.sendHead();
    }

    private sendHead(): void {
        if(this.headersSent){
            return;
        }
        this.headersSent = true;
        post(this.channel, {
            type: 'head',
            status: this.statusCode,
            statusMessage: this.statusMessage || STATUS_CODES[this.statusCode] || '',
            headers: this.serializeHeaders()
        });
    }

    override _write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        this.sendHead();
        post(this.channel, { type: 'data', chunk: toBytes(chunk, encoding) });
        callback();
    }

    override _final(callback: (error?: Error | null) => void): void {
        this.sendHead();
        callback();
    }
}

interface ServerOptions {
    requestTimeout?: number;
}

export class Server extends EventEmitter {
    timeout = 0;
    requestTimeout = 0;
    headersTimeout = 60_000;
    keepAliveTimeout = 5_000;
    maxHeadersCount: number | null = null;
    listening = false;
    private port: number | null = null;

    constructor(optionsOrListener?: ServerOptions | ((req: IncomingMessage, res: ServerResponse) => void), listener?: (req: IncomingMessage, res: ServerResponse) => void){
        super();
        const requestListener = typeof optionsOrListener === 'function' ? optionsOrListener : listener;
        if(requestListener){
            this.on('request', requestListener);
        }
    }

    listen(...args: unknown[]): this {
        const callback = args.find((arg): arg is () => void => typeof arg === 'function');
        const first = args[0];
        const port = typeof first === 'object' && first !== null
            ? Number((first as { port?: number }).port ?? 0)
            : Number(first ?? 0);
        listenLoopback(port, (connection) => this.accept(connection));
        this.port = port;
        this.listening = true;
        if(callback){
            this.once('listening', callback);
        }
        queueMicrotask(() => this.emit('listening'));
        return this;
    }

    address(): { address: string; family: string; port: number } | null {
        return this.port === null ? null : { address: '127.0.0.1', family: 'IPv4', port: this.port };
    }

    close(callback?: (error?: Error) => void): this {
        if(this.port !== null){
            closeLoopback(this.port);
            this.port = null;
        }
        this.listening = false;
        queueMicrotask(() => {
            this.emit('close');
            callback?.();
        });
        return this;
    }

    closeAllConnections(): void {}

    closeIdleConnections(): void {}

    setTimeout(timeout = 0, callback?: () => void): this {
        this.timeout = timeout;
        if(callback){
            this.on('timeout', callback);
        }
        return this;
    }

    getConnections(callback: (error: Error | null, count: number) => void): void {
        callback(null, 0);
    }

    ref(): this { return this; }

    unref(): this { return this; }

    private accept(connection: LoopbackConnection): void {
        const socket = new LoopbackSocket();
        this.emit('connection', socket);
        const req = new IncomingMessage(socket);
        req.method = connection.head.method;
        req.url = connection.head.url;
        req.setHeaders(normalizeHeaders(connection.head.headers));

        if(connection.kind === 'ws'){
            // engine.io and ws take the upgrade from here; the socket carries the channel to the peer.
            Object.assign(socket, { loopbackChannel: connection.channel });
            req.finish();
            this.emit('upgrade', req, socket, Buffer.alloc(0));
            return;
        }

        connection.channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => {
            const message = event.data;
            if(message.type === 'data'){
                req.pushChunk(message.chunk);
            }else if(message.type === 'end'){
                req.finish();
            }else if(message.type === 'close' || message.type === 'error'){
                req.aborted = true;
                req.destroy();
                socket.destroy();
            }
        };
        this.emit('request', req, new ServerResponse(req, connection.channel));
    }
}

export const createServer = (
    optionsOrListener?: ServerOptions | ((req: IncomingMessage, res: ServerResponse) => void),
    listener?: (req: IncomingMessage, res: ServerResponse) => void
): Server => new Server(optionsOrListener, listener);

export class Agent extends EventEmitter {
    maxSockets = Infinity;
    maxFreeSockets = 256;
    destroy(): void {}
}

export const globalAgent = new Agent();

interface RequestOptions {
    protocol?: string;
    hostname?: string;
    host?: string;
    port?: number | string;
    method?: string;
    path?: string;
    headers?: Record<string, HeaderValue>;
    signal?: AbortSignal;
    timeout?: number;
}

export class ClientRequest extends OutgoingMessage {
    readonly method: string;
    readonly path: string;
    readonly host: string;
    readonly socket = new LoopbackSocket();
    aborted = false;
    private channel: MessagePort | null = null;
    private readonly port: number;

    constructor(options: RequestOptions, callback?: (res: IncomingMessage) => void){
        super();
        this.method = (options.method ?? 'GET').toUpperCase();
        this.path = options.path ?? '/';
        this.host = options.hostname ?? options.host?.replace(/:\d+$/, '') ?? 'localhost';
        this.port = Number(options.port ?? 80);
        for(const [name, value] of Object.entries(options.headers ?? {})){
            this.setHeader(name, value);
        }
        if(callback){
            this.once('response', callback);
        }
        options.signal?.addEventListener('abort', () => this.destroy(Object.assign(new Error('The operation was aborted'), { name: 'AbortError', code: 'ABORT_ERR' })));
        queueMicrotask(() => this.emit('socket', this.socket));
    }

    setTimeout(): this { return this; }
    setNoDelay(): void {}
    setSocketKeepAlive(): void {}

    abort(): void {
        this.aborted = true;
        this.destroy();
    }

    private open(): MessagePort {
        if(this.channel){
            return this.channel;
        }
        if(!isLoopbackHost(this.host)){
            throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${this.host}`), { code: 'ENOTFOUND' });
        }
        this.headersSent = true;
        const head: LoopbackRequestHead = {
            method: this.method,
            url: this.path,
            headers: Object.fromEntries(Object.entries(this.serializeHeaders()).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]))
        };
        const channel = connectLoopback(this.port, 'http', head);
        const res = new IncomingMessage(this.socket);
        channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => {
            const message = event.data;
            if(message.type === 'head'){
                res.statusCode = message.status;
                res.statusMessage = message.statusMessage;
                res.setHeaders(message.headers);
                this.emit('response', res);
            }else if(message.type === 'data'){
                res.pushChunk(message.chunk);
            }else if(message.type === 'end'){
                res.finish();
                this.emit('close');
            }else if(message.type === 'error'){
                const error = Object.assign(new Error(message.message), { code: message.message.split(' ')[1] ?? 'ECONNRESET' });
                if(res.listenerCount('data') > 0 || res.readableFlowing){
                    res.destroy(error);
                }else{
                    this.emit('error', error);
                }
            }
        };
        this.channel = channel;
        return channel;
    }

    override _write(chunk: unknown, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        try{
            post(this.open(), { type: 'data', chunk: toBytes(chunk, encoding) });
            callback();
        }catch(error){
            callback(error as Error);
        }
    }

    override _final(callback: (error?: Error | null) => void): void {
        try{
            post(this.open(), { type: 'end' });
            this.finished = true;
            callback();
        }catch(error){
            callback(error as Error);
        }
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        this.channel?.postMessage({ type: 'close', code: 1006, reason: 'aborted' } satisfies LoopbackChannelMessage);
        this.channel?.close();
        callback(error);
    }
}

const parseRequestArgs = (input: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown): [RequestOptions, ((res: IncomingMessage) => void) | undefined] => {
    const callback = [optionsOrCallback, maybeCallback].find((arg): arg is (res: IncomingMessage) => void => typeof arg === 'function');
    const extra = typeof optionsOrCallback === 'object' && optionsOrCallback !== null ? optionsOrCallback as RequestOptions : {};
    if(typeof input === 'string' || input instanceof URL){
        const url = new URL(String(input));
        return [{
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            ...extra
        }, callback];
    }
    return [{ ...(input as RequestOptions), ...extra }, callback];
};

export const request = (input: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown): ClientRequest => {
    const [options, callback] = parseRequestArgs(input, optionsOrCallback, maybeCallback);
    return new ClientRequest(options, callback);
};

export const get = (input: unknown, optionsOrCallback?: unknown, maybeCallback?: unknown): ClientRequest => {
    const req = request(input, optionsOrCallback, maybeCallback);
    req.end();
    return req;
};

export const validateHeaderName = (name: string): void => {
    if(!/^[\^_`a-zA-Z\-0-9!#$%&'*+.|~]+$/.test(name)){
        throw Object.assign(new TypeError(`Header name must be a valid HTTP token ["${name}"]`), { code: 'ERR_INVALID_HTTP_TOKEN' });
    }
};

export const validateHeaderValue = (name: string, value: unknown): void => {
    if(value === undefined){
        throw Object.assign(new TypeError(`Invalid value "undefined" for header "${name}"`), { code: 'ERR_HTTP_INVALID_HEADER_VALUE' });
    }
};

export const maxHeaderSize = 16_384;

export default {
    METHODS,
    STATUS_CODES,
    Agent,
    globalAgent,
    ClientRequest,
    IncomingMessage,
    OutgoingMessage,
    Server,
    ServerResponse,
    createServer,
    request,
    get,
    validateHeaderName,
    validateHeaderValue,
    maxHeaderSize
};
