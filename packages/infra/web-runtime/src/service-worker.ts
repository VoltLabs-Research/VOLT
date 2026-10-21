// The service worker of a web client running its local stack: what the page asks of the backend (its
// API and socket.io polling, and URLs on loopback hosts, which the server hands out for the daemon's
// object gateway) is relayed to the stack over the loopback network, through the page that asked,
// which hosts the backends' workers. Responses from the network get the COOP/COEP headers that make
// the page cross-origin isolated, which the backends' SharedArrayBuffers need, wherever it is hosted.
import { connectLoopbackThrough, isLoopbackHost, type MessageTarget } from './platform/loopback';
import { loopbackFetch } from './platform/fetch';
import { DEFAULT_SERVER_PORT, serverOriginFor } from '@volt/local-stack/defaults';

// The parts of ServiceWorkerGlobalScope used here (the WebWorker lib cannot be combined with DOM).
interface FetchEvent extends Event {
    request: Request;
    clientId: string;
    respondWith(response: Promise<Response>): void;
}

interface WindowClient extends MessageTarget {
    type: 'window' | 'worker' | 'sharedworker';
}

interface ServiceWorkerScope {
    addEventListener(type: 'install', listener: () => void): void;
    addEventListener(type: 'activate', listener: (event: Event & { waitUntil(promise: Promise<unknown>): void }) => void): void;
    addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
    skipWaiting(): Promise<void>;
    clients: {
        claim(): Promise<void>;
        get(id: string): Promise<WindowClient | undefined>;
        matchAll(options: { type: 'window' }): Promise<WindowClient[]>;
    };
}

const scope = globalThis as unknown as ServiceWorkerScope;

// The paths of the page's origin that the client sends to its backend.
const SERVER_PATHS = ['/api/', '/socket.io/'];

const serverOrigin = serverOriginFor(DEFAULT_SERVER_PORT);

const isolate = (response: Response): Response => {
    if(response.type === 'opaque' || response.type === 'opaqueredirect'){
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

// The page hosting the stack: the one that made the request, or, for a request from one of its
// workers, a page of this origin.
const hostOf = async (clientId: string): Promise<WindowClient | undefined> => {
    const client = clientId ? await scope.clients.get(clientId) : undefined;
    if(client?.type === 'window'){
        return client;
    }
    return (await scope.clients.matchAll({ type: 'window' }))[0];
};

const relay = async (event: FetchEvent, target: URL): Promise<Response> => {
    const host = await hostOf(event.clientId);
    if(!host){
        return new Response('No page of this origin is running the local stack', { status: 503 });
    }
    const request = event.request;
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const forwarded = new Request(target, {
        method: request.method,
        headers: request.headers,
        body: hasBody ? (request.body ?? await request.arrayBuffer()) : undefined,
        redirect: 'manual',
        signal: request.signal,
        duplex: 'half'
    } as RequestInit);
    return loopbackFetch(forwarded, connectLoopbackThrough(host));
};

scope.addEventListener('install', () => {
    void scope.skipWaiting();
});

scope.addEventListener('activate', (event) => {
    event.waitUntil(scope.clients.claim());
});

scope.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if(url.origin === location.origin && SERVER_PATHS.some((prefix) => url.pathname.startsWith(prefix))){
        event.respondWith(relay(event, new URL(`${url.pathname}${url.search}`, serverOrigin)));
    }else if(isLoopbackHost(url.hostname) && url.origin !== location.origin){
        event.respondWith(relay(event, url));
    }else if(url.origin === location.origin){
        event.respondWith(fetch(event.request).then(isolate));
    }
});
