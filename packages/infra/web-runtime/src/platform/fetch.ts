// The fetch() backend workers see: requests to a loopback host are served over the loopback network,
// everything else goes to the network.
import { ownBytes } from './bytes';
import { connectLoopback, isLoopbackUrl } from './loopback';
import type { LoopbackChannelMessage, LoopbackConnector } from './loopback';

const nativeFetch = globalThis.fetch.bind(globalThis);

const sendBody = async (channel: MessagePort, body: ReadableStream<Uint8Array> | null): Promise<void> => {
    if(body){
        const reader = body.getReader();
        for(;;){
            const { done, value } = await reader.read();
            if(done){
                break;
            }
            const chunk = ownBytes(value);
            channel.postMessage({ type: 'data', chunk } satisfies LoopbackChannelMessage, [chunk.buffer]);
        }
    }
    channel.postMessage({ type: 'end' } satisfies LoopbackChannelMessage);
};

// The length of a body Node's fetch knows the length of, which it declares; a Request keeps it from
// its headers (content-length is a header only the browser sets).
export const bodyLength = (body: BodyInit | null | undefined): number | undefined => {
    if(typeof body === 'string'){
        return new TextEncoder().encode(body).byteLength;
    }
    if(body instanceof ArrayBuffer || ArrayBuffer.isView(body)){
        return body.byteLength;
    }
    if(body instanceof Blob){
        return body.size;
    }
    if(body instanceof URLSearchParams){
        return new TextEncoder().encode(body.toString()).byteLength;
    }
    return undefined;
};

export const loopbackFetch = (request: Request, connect: LoopbackConnector = connectLoopback, length?: number): Promise<Response> => {
    const url = new URL(request.url);
    const headers: Record<string, string> = { host: url.host };
    request.headers.forEach((value, name) => {
        headers[name] = value;
    });
    // Body parsers skip a request that declares neither a length nor chunked encoding: a body of
    // unknown length (a stream) goes out chunked, as Node's fetch sends it.
    if(request.body){
        if(length === undefined){
            headers['transfer-encoding'] = 'chunked';
        }else{
            headers['content-length'] = String(length);
        }
    }
    const channel = connect(Number(url.port || 80), 'http', {
        method: request.method,
        url: `${url.pathname}${url.search}`,
        headers
    });

    return new Promise<Response>((resolve, reject) => {
        let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
        const body = new ReadableStream<Uint8Array>({
            start(streamController){
                controller = streamController;
            },
            cancel(){
                channel.postMessage({ type: 'close', code: 1000, reason: 'cancelled' } satisfies LoopbackChannelMessage);
                channel.close();
            }
        });
        request.signal.addEventListener('abort', () => {
            channel.postMessage({ type: 'close', code: 1000, reason: 'aborted' } satisfies LoopbackChannelMessage);
            channel.close();
            const error = new DOMException('The operation was aborted.', 'AbortError');
            controller?.error(error);
            reject(error);
        });
        channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => {
            const message = event.data;
            if(message.type === 'head'){
                const responseHeaders = new Headers();
                for(const [name, value] of Object.entries(message.headers)){
                    for(const item of Array.isArray(value) ? value : [value]){
                        responseHeaders.append(name, item);
                    }
                }
                const hasBody = request.method !== 'HEAD' && ![101, 204, 205, 304].includes(message.status);
                resolve(new Response(hasBody ? body : null, {
                    status: message.status,
                    statusText: message.statusMessage,
                    headers: responseHeaders
                }));
            }else if(message.type === 'data'){
                controller?.enqueue(message.chunk);
            }else if(message.type === 'end'){
                controller?.close();
                channel.close();
            }else if(message.type === 'error'){
                const error = new TypeError(`fetch failed: ${message.message}`);
                controller?.error(error);
                reject(error);
            }
        };
        sendBody(channel, request.body).catch(reject);
    });
};

export const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    return isLoopbackUrl(new URL(request.url)) ? loopbackFetch(request, connectLoopback, bodyLength(init?.body)) : nativeFetch(request);
};
