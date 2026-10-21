// The calling side of the fs channel: blocks the worker until the file system service replies.
import {
    DATA_BYTES,
    STATE_IDLE,
    STATE_REQUEST,
    createChannelBuffers,
    decodeMessage,
    encodeMessage
} from './channel';
import { BrowserWorker } from '../browser-worker';
import { errnoOf } from '../os';
import type { FsChannelBuffers, FsReply } from './channel';

let control: Int32Array | null = null;
let data: Uint8Array | null = null;

export const attachFsChannel = (buffers: FsChannelBuffers): void => {
    control = new Int32Array(buffers.control);
    data = new Uint8Array(buffers.data);
};

// Starts the file system service for `directory` and attaches this worker to it. Workers this one
// starts (plugins) attach to the same service with buffers from createFsChannel().
let service: Worker | null = null;

export const startFsService = (serviceUrl: string | URL, directory: string): Promise<void> => {
    service = new BrowserWorker(serviceUrl, { type: 'module', name: 'fs' });
    const mounted = new Promise<void>((resolve, reject) => {
        service?.addEventListener('message', (event: MessageEvent<{ kind: string; message?: string }>) => {
            if(event.data.kind === 'mounted'){
                resolve();
            }else if(event.data.kind === 'failed'){
                reject(new Error(`fs: mounting ${directory} failed: ${event.data.message}`));
            }
        });
    });
    service.postMessage({ kind: 'mount', directory });
    attachFsChannel(createFsChannel());
    return mounted;
};

export const createFsChannel = (): FsChannelBuffers => {
    if(!service){
        throw new Error('fs: the file system service has not been started');
    }
    const buffers = createChannelBuffers();
    service.postMessage({ kind: 'attach', buffers });
    return buffers;
};

const exchange = (controlWords: Int32Array, area: Uint8Array, message: Uint8Array): Uint8Array => {
    // Every chunk but the last is acknowledged with an empty response; the reply to the last one is
    // the first chunk of the service's answer.
    let offset = 0;
    do{
        const length = Math.min(DATA_BYTES, message.byteLength - offset);
        area.set(message.subarray(offset, offset + length));
        offset += length;
        controlWords[1] = length;
        controlWords[2] = offset < message.byteLength ? 1 : 0;
        Atomics.store(controlWords, 0, STATE_REQUEST);
        Atomics.notify(controlWords, 0);
        Atomics.wait(controlWords, 0, STATE_REQUEST);
    }while(offset < message.byteLength);
    const parts: Uint8Array[] = [];
    let total = 0;
    for(;;){
        const part = area.slice(0, controlWords[1]);
        parts.push(part);
        total += part.byteLength;
        if(controlWords[2] === 0){
            break;
        }
        Atomics.store(controlWords, 0, STATE_REQUEST);
        Atomics.notify(controlWords, 0);
        Atomics.wait(controlWords, 0, STATE_REQUEST);
    }
    Atomics.store(controlWords, 0, STATE_IDLE);
    if(parts.length === 1){
        return parts[0];
    }
    const reply = new Uint8Array(total);
    let written = 0;
    for(const part of parts){
        reply.set(part, written);
        written += part.byteLength;
    }
    return reply;
};

export interface FsCallError extends Error {
    code: string;
    syscall: string;
    path?: string;
    errno: number;
}

export const callFs = (op: string, args: unknown[], body?: Uint8Array): { value: unknown; body: Uint8Array } => {
    if(!control || !data){
        throw new Error('fs: this worker is not attached to a file system service');
    }
    const { header, body: replyBody } = decodeMessage<FsReply>(exchange(control, data, encodeMessage({ op, args }, body)));
    if(!header.ok){
        throw Object.assign(new Error(header.message), {
            code: header.code,
            syscall: header.syscall,
            path: header.path,
            errno: errnoOf(header.code)
        }) as FsCallError;
    }
    return { value: header.value, body: replyBody };
};
