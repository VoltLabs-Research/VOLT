// The loopback network the backends talk over: what is 127.0.0.1 between Node processes on the
// desktop is, here, MessagePorts between workers. A worker that listens on a port registers it with
// the host page, which forwards connections for that port to it; connections to a port the same
// worker listens on never leave it.

export interface LoopbackRequestHead {
    method: string;
    url: string;
    headers: Record<string, string>;
}

export type LoopbackConnectionKind = 'http' | 'ws';

export interface LoopbackConnectMessage {
    kind: 'connect';
    port: number;
    connection: LoopbackConnectionKind;
    head: LoopbackRequestHead;
}

export interface LoopbackListenMessage {
    kind: 'listen';
    port: number;
}

export interface LoopbackConnection {
    kind: LoopbackConnectionKind;
    head: LoopbackRequestHead;
    channel: MessagePort;
}

// Messages on a connection's channel. The client side sends the request body (http) or messages (ws);
// the server side answers with the response head and body (http) or open/messages (ws).
export type LoopbackChannelMessage =
    | { type: 'head'; status: number; statusMessage: string; headers: Record<string, string | string[]> }
    | { type: 'open'; protocol: string }
    | { type: 'data'; chunk: Uint8Array }
    | { type: 'message'; data: string | ArrayBuffer }
    | { type: 'end' }
    | { type: 'close'; code: number; reason: string }
    | { type: 'error'; message: string };

type ConnectionListener = (connection: LoopbackConnection) => void;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]']);

const listeners = new Map<number, ConnectionListener>();

// The page that hosts the workers, or a stand-in when the backends run in the page itself.
let host: Pick<MessagePort, 'postMessage'> | null = null;

export const isLoopbackHost = (hostname: string): boolean => LOOPBACK_HOSTS.has(hostname);

// A loopback URL from the backends' point of view, but not the origin the page itself is served
// from (during development that is a localhost origin too, and its assets come from the network).
export const isLoopbackUrl = (url: URL): boolean => isLoopbackHost(url.hostname) && url.origin !== globalThis.location?.origin;

export const attachLoopbackHost = (target: Pick<MessagePort, 'postMessage'>): void => {
    host = target;
    for(const port of listeners.keys()){
        target.postMessage({ kind: 'listen', port } satisfies LoopbackListenMessage);
    }
};

export const listenLoopback = (port: number, listener: ConnectionListener): void => {
    if(listeners.has(port)){
        throw Object.assign(new Error(`listen EADDRINUSE: address already in use 127.0.0.1:${port}`), { code: 'EADDRINUSE' });
    }
    listeners.set(port, listener);
    host?.postMessage({ kind: 'listen', port } satisfies LoopbackListenMessage);
};

export const closeLoopback = (port: number): void => {
    listeners.delete(port);
};

// Delivers a connection the host forwarded to this worker.
export const acceptLoopbackConnection = (message: LoopbackConnectMessage, channel: MessagePort): void => {
    const listener = listeners.get(message.port);
    if(!listener){
        channel.postMessage({ type: 'error', message: `connect ECONNREFUSED 127.0.0.1:${message.port}` } satisfies LoopbackChannelMessage);
        channel.close();
        return;
    }
    listener({ kind: message.connection, head: message.head, channel });
};

export const connectLoopback = (port: number, connection: LoopbackConnectionKind, head: LoopbackRequestHead): MessagePort => {
    const { port1, port2 } = new MessageChannel();
    const message: LoopbackConnectMessage = { kind: 'connect', port, connection, head };
    if(listeners.has(port)){
        acceptLoopbackConnection(message, port2);
    }else if(host){
        host.postMessage(message, [port2]);
    }else{
        port2.postMessage({ type: 'error', message: `connect ECONNREFUSED 127.0.0.1:${port}` } satisfies LoopbackChannelMessage);
        port2.close();
    }
    return port1;
};
