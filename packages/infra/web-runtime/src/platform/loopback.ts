// The loopback network the backends talk over: what is 127.0.0.1 between Node processes on the
// desktop is, here, MessagePorts between workers. Every realm (the page, a backend worker, a worker a
// backend starts) routes a connection to the port's listener: its own, one of its child workers', or
// its parent's. Children announce the ports they listen on to their parent, which announces them
// upwards, so any realm can reach any port.

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

export type MessageTarget = { postMessage(message: unknown, transfer?: Transferable[]): void };

type ConnectionListener = (connection: LoopbackConnection) => void;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1', '[::1]']);

const listeners = new Map<number, ConnectionListener>();
const childRoutes = new Map<number, MessageTarget>();
let parent: MessageTarget | null = null;

export const isLoopbackHost = (hostname: string): boolean => LOOPBACK_HOSTS.has(hostname);

// A loopback URL from the backends' point of view, but not the origin the page itself is served
// from (during development that is a localhost origin too, and its assets come from the network).
export const isLoopbackUrl = (url: URL): boolean => isLoopbackHost(url.hostname) && url.origin !== globalThis.location?.origin;

const refuse = (channel: MessagePort, port: number): void => {
    channel.postMessage({ type: 'error', message: `connect ECONNREFUSED 127.0.0.1:${port}` } satisfies LoopbackChannelMessage);
    channel.close();
};

// A connection for a port this realm or one of its children serves; null when neither does.
const deliver = (message: LoopbackConnectMessage, channel: MessagePort): boolean => {
    const listener = listeners.get(message.port);
    if(listener){
        listener({ kind: message.connection, head: message.head, channel });
        return true;
    }
    const child = childRoutes.get(message.port);
    if(child){
        child.postMessage(message, [channel]);
        return true;
    }
    return false;
};

const route = (message: LoopbackConnectMessage, channel: MessagePort): void => {
    if(deliver(message, channel)){
        return;
    }
    if(parent){
        parent.postMessage(message, [channel]);
        return;
    }
    refuse(channel, message.port);
};

export const attachLoopbackParent = (target: MessageTarget): void => {
    parent = target;
    for(const port of [...listeners.keys(), ...childRoutes.keys()]){
        target.postMessage({ kind: 'listen', port } satisfies LoopbackListenMessage);
    }
};

export const listenLoopback = (port: number, listener: ConnectionListener): void => {
    if(listeners.has(port) || childRoutes.has(port)){
        throw Object.assign(new Error(`listen EADDRINUSE: address already in use 127.0.0.1:${port}`), { code: 'EADDRINUSE' });
    }
    listeners.set(port, listener);
    parent?.postMessage({ kind: 'listen', port } satisfies LoopbackListenMessage);
};

export const closeLoopback = (port: number): void => {
    listeners.delete(port);
};

// A connection the parent forwarded down to this realm. It never goes back up, so a port nobody
// serves is refused instead of bouncing between realms.
export const acceptLoopbackConnection = (message: LoopbackConnectMessage, channel: MessagePort): void => {
    if(!deliver(message, channel)){
        refuse(channel, message.port);
    }
};

// Loopback messages from a child worker: the ports it listens on, and the connections it opens.
export const handleChildLoopbackMessage = (child: MessageTarget, message: LoopbackListenMessage | LoopbackConnectMessage, ports: readonly MessagePort[]): void => {
    if(message.kind === 'listen'){
        childRoutes.set(message.port, child);
        parent?.postMessage(message);
        return;
    }
    route(message, ports[0]);
};

export const forgetChildRoutes = (child: MessageTarget): void => {
    for(const [port, target] of childRoutes){
        if(target === child){
            childRoutes.delete(port);
        }
    }
};

export const connectLoopback = (port: number, connection: LoopbackConnectionKind, head: LoopbackRequestHead): MessagePort => {
    const { port1, port2 } = new MessageChannel();
    route({ kind: 'connect', port, connection, head }, port2);
    return port1;
};
