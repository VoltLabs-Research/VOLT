// WebSockets over the loopback network. The server side is the `ws` package API engine.io drives
// (WebSocketServer.handleUpgrade and the per-connection socket); the client side is the browser
// WebSocket, which engine.io-client and socket.io-client construct. Frames are not encoded: each
// message crosses the channel as one string or ArrayBuffer.
import { EventEmitter } from 'events';
import { connectLoopback, isLoopbackUrl } from './loopback';
import type { LoopbackChannelMessage } from './loopback';
import type { IncomingMessage, LoopbackSocket } from './http';

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

const toTransferable = (data: unknown): string | ArrayBuffer => {
    if(typeof data === 'string'){
        return data;
    }
    if(data instanceof ArrayBuffer){
        return data.slice(0);
    }
    if(ArrayBuffer.isView(data)){
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer;
    }
    if(Array.isArray(data)){
        return Buffer.concat(data as Buffer[]).buffer.slice(0);
    }
    return String(data);
};

const postMessage = (channel: MessagePort, data: string | ArrayBuffer): void => {
    const message: LoopbackChannelMessage = { type: 'message', data };
    channel.postMessage(message, typeof data === 'string' ? [] : [data]);
};

// The `ws` WebSocket a server handler receives.
export class ServerWebSocket extends EventEmitter {
    static readonly CONNECTING = CONNECTING;
    static readonly OPEN = OPEN;
    static readonly CLOSING = CLOSING;
    static readonly CLOSED = CLOSED;
    readyState = OPEN;
    readonly protocol: string;
    readonly extensions = '';
    readonly binaryType = 'nodebuffer';
    bufferedAmount = 0;
    readonly _socket: LoopbackSocket;
    private readonly channel: MessagePort;

    constructor(channel: MessagePort, socket: LoopbackSocket, protocol: string){
        super();
        this.channel = channel;
        this._socket = socket;
        this.protocol = protocol;
        channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => {
            const message = event.data;
            if(message.type === 'message'){
                const isBinary = typeof message.data !== 'string';
                this.emit('message', isBinary ? Buffer.from(message.data as ArrayBuffer) : Buffer.from(message.data as string), isBinary);
            }else if(message.type === 'close' || message.type === 'error'){
                this.finish(message.type === 'close' ? message.code : 1006, message.type === 'close' ? message.reason : message.message);
            }
        };
    }

    send(data: unknown, optionsOrCallback?: unknown, maybeCallback?: (error?: Error) => void): void {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback as (error?: Error) => void : maybeCallback;
        if(this.readyState !== OPEN){
            callback?.(new Error('WebSocket is not open'));
            return;
        }
        postMessage(this.channel, toTransferable(data));
        callback?.();
    }

    ping(): void {}

    pong(): void {}

    close(code = 1000, reason = ''): void {
        if(this.readyState >= CLOSING){
            return;
        }
        this.channel.postMessage({ type: 'close', code, reason } satisfies LoopbackChannelMessage);
        this.finish(code, reason);
    }

    terminate(): void {
        this.close(1006, '');
    }

    private finish(code: number, reason: string): void {
        if(this.readyState === CLOSED){
            return;
        }
        this.readyState = CLOSED;
        this.channel.close();
        this._socket.destroy();
        this.emit('close', code, Buffer.from(reason));
    }
}

interface WebSocketServerOptions {
    noServer?: boolean;
    handleProtocols?: (protocols: Set<string>, request: IncomingMessage) => string | false;
}

export class WebSocketServer extends EventEmitter {
    readonly clients = new Set<ServerWebSocket>();
    private readonly options: WebSocketServerOptions;

    constructor(options: WebSocketServerOptions = {}){
        super();
        this.options = options;
    }

    handleUpgrade(request: IncomingMessage, socket: LoopbackSocket, _head: Buffer, callback: (socket: ServerWebSocket, request: IncomingMessage) => void): void {
        const channel = (socket as LoopbackSocket & { loopbackChannel?: MessagePort }).loopbackChannel;
        if(!channel){
            socket.destroy();
            return;
        }
        const offered = new Set(String(request.headers['sec-websocket-protocol'] ?? '').split(',').map((value) => value.trim()).filter(Boolean));
        const chosen = this.options.handleProtocols ? this.options.handleProtocols(offered, request) : [...offered][0];
        const protocol = chosen || '';
        const webSocket = new ServerWebSocket(channel, socket, protocol);
        this.clients.add(webSocket);
        webSocket.once('close', () => this.clients.delete(webSocket));
        channel.postMessage({ type: 'open', protocol } satisfies LoopbackChannelMessage);
        callback(webSocket, request);
        this.emit('connection', webSocket, request);
    }

    shouldHandle(): boolean {
        return true;
    }

    close(callback?: () => void): void {
        for(const client of this.clients){
            client.terminate();
        }
        queueMicrotask(() => callback?.());
    }
}

const NativeWebSocket = globalThis.WebSocket;

// The browser WebSocket, connecting over the loopback network when the URL names a loopback host.
export class LoopbackWebSocket extends EventTarget {
    static readonly CONNECTING = CONNECTING;
    static readonly OPEN = OPEN;
    static readonly CLOSING = CLOSING;
    static readonly CLOSED = CLOSED;
    readonly CONNECTING = CONNECTING;
    readonly OPEN = OPEN;
    readonly CLOSING = CLOSING;
    readonly CLOSED = CLOSED;
    readonly url: string;
    readyState = CONNECTING;
    protocol = '';
    extensions = '';
    bufferedAmount = 0;
    binaryType: BinaryType = 'blob';
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    private readonly channel: MessagePort;

    constructor(url: string | URL, protocols?: string | string[]){
        super();
        const target = new URL(String(url));
        this.url = target.href;
        const offered = Array.isArray(protocols) ? protocols : protocols ? [protocols] : [];
        this.channel = connectLoopback(Number(target.port || 80), 'ws', {
            method: 'GET',
            url: `${target.pathname}${target.search}`,
            headers: {
                host: target.host,
                connection: 'Upgrade',
                upgrade: 'websocket',
                'sec-websocket-version': '13',
                ...(offered.length > 0 ? { 'sec-websocket-protocol': offered.join(', ') } : {})
            }
        });
        this.channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => this.receive(event.data);
    }

    private dispatch<E extends Event>(event: E, handler: ((event: E) => void) | null): void {
        handler?.call(this, event);
        this.dispatchEvent(event);
    }

    private receive(message: LoopbackChannelMessage): void {
        if(message.type === 'open'){
            this.readyState = OPEN;
            this.protocol = message.protocol;
            this.dispatch(new Event('open'), this.onopen);
        }else if(message.type === 'message'){
            const data = typeof message.data === 'string' || this.binaryType === 'arraybuffer'
                ? message.data
                : new Blob([message.data]);
            this.dispatch(new MessageEvent('message', { data }), this.onmessage);
        }else if(message.type === 'close'){
            this.finish(message.code, message.reason, true);
        }else if(message.type === 'error'){
            this.dispatch(new Event('error'), this.onerror);
            this.finish(1006, message.message, false);
        }
    }

    send(data: string | ArrayBufferLike | ArrayBufferView | Blob): void {
        if(this.readyState === CONNECTING){
            throw new DOMException("Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.", 'InvalidStateError');
        }
        if(this.readyState !== OPEN){
            return;
        }
        if(data instanceof Blob){
            void data.arrayBuffer().then((buffer) => postMessage(this.channel, buffer));
            return;
        }
        postMessage(this.channel, toTransferable(data));
    }

    close(code = 1000, reason = ''): void {
        if(this.readyState >= CLOSING){
            return;
        }
        this.readyState = CLOSING;
        this.channel.postMessage({ type: 'close', code, reason } satisfies LoopbackChannelMessage);
        this.finish(code, reason, true);
    }

    private finish(code: number, reason: string, wasClean: boolean): void {
        if(this.readyState === CLOSED){
            return;
        }
        this.readyState = CLOSED;
        this.channel.close();
        this.dispatch(new CloseEvent('close', { code, reason, wasClean }), this.onclose);
    }
}

// What `new WebSocket(url)` builds in a backend worker: loopback URLs go to the loopback network,
// anything else to the network.
export const WebSocketConstructor = new Proxy(NativeWebSocket, {
    construct(target, args: [string | URL, (string | string[])?]){
        const url = new URL(String(args[0]));
        return isLoopbackUrl(url) ? new LoopbackWebSocket(...args) : new target(...args);
    }
});

export const WebSocket = ServerWebSocket;

export { WebSocketServer as Server };

export default Object.assign(ServerWebSocket, {
    WebSocket: ServerWebSocket,
    WebSocketServer,
    Server: WebSocketServer
});
