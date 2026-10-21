// Node's `worker_threads`: a Worker runs one of the runtime's bundled programs in a nested worker
// that shares this realm's file system, with workerData, parentPort and exit codes as in Node.
import { EventEmitter } from 'events';
import pathModule from 'path';
import { BrowserWorker } from './browser-worker';
import { createFsChannel } from './fs/client';
import { forgetChildRoutes, handleChildLoopbackMessage } from './loopback';
import type { LoopbackConnectMessage, LoopbackListenMessage } from './loopback';
import { nodeWorkerFor } from './child-process';
import type { BackendBootMessage, BackendWorkerMessage, ParentToChildMessage } from '../workers/protocol';

interface ThreadContext {
    threadId: number;
    workerData: unknown;
    port: { postMessage(message: unknown): void };
}

let context: ThreadContext | null = null;

// Messages wait in the port until the thread listens, as a MessagePort holds them until started:
// the thread's script subscribes only once it has loaded, after its first messages have arrived.
class ParentPort extends EventEmitter {
    private pending: unknown[] | null = [];

    constructor(){
        super();
        this.on('newListener', (event: string) => {
            const pending = this.pending;
            if(event === 'message' && pending){
                this.pending = null;
                queueMicrotask(() => {
                    for(const message of pending){
                        this.emit('message', message);
                    }
                });
            }
        });
    }

    deliver(message: unknown): void {
        if(this.pending){
            this.pending.push(message);
            return;
        }
        this.emit('message', message);
    }

    postMessage(message: unknown): void {
        context?.port.postMessage({ kind: 'ipc', message } satisfies BackendWorkerMessage);
    }

    close(): void {}
    ref(): void {}
    unref(): void {}
}

const parentPortInstance = new ParentPort();

// Called by the worker entry when this realm is a thread; module consumers read the exports below.
export const enterThread = (thread: ThreadContext): void => {
    context = thread;
    Object.assign(exportsObject, { isMainThread: false, parentPort: parentPortInstance, workerData: thread.workerData, threadId: thread.threadId });
};

export const deliverToParentPort = (message: unknown): void => {
    parentPortInstance.deliver(message);
};

let nextThreadId = 1;

interface WorkerOptions {
    workerData?: unknown;
    env?: Record<string, string | undefined>;
    argv?: string[];
}

export class Worker extends EventEmitter {
    readonly threadId: number;
    private readonly worker: globalThis.Worker;
    private exited = false;

    constructor(filename: string | URL, options: WorkerOptions = {}){
        super();
        nextThreadId += 1;
        this.threadId = nextThreadId;
        const scriptPath = pathModule.resolve(process.cwd(), filename instanceof URL ? decodeURIComponent(filename.pathname) : filename);
        const workerUrl = nodeWorkerFor(scriptPath);
        if(!workerUrl){
            throw Object.assign(new Error(`Cannot find module '${scriptPath}'`), { code: 'MODULE_NOT_FOUND' });
        }
        this.worker = new BrowserWorker(workerUrl, { type: 'module', name: `thread-${this.threadId}` });
        this.worker.addEventListener('message', (event: MessageEvent<BackendWorkerMessage | LoopbackListenMessage | LoopbackConnectMessage>) => {
            const message = event.data;
            if(message.kind === 'listen' || message.kind === 'connect'){
                handleChildLoopbackMessage(this.worker, message, event.ports);
            }else if(message.kind === 'ipc'){
                this.emit('message', message.message);
            }else if(message.kind === 'output'){
                (message.stream === 'stdout' ? process.stdout : process.stderr).write(message.chunk);
            }else if(message.kind === 'exit'){
                this.end(message.code);
            }else if(message.kind === 'failed'){
                this.emit('error', new Error(message.message));
                this.end(1);
            }
        });
        this.worker.addEventListener('error', (event) => {
            this.emit('error', new Error(event.message));
            this.end(1);
        });
        const env = Object.fromEntries(Object.entries(options.env ?? process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
        const fs = createFsChannel();
        this.worker.postMessage({
            kind: 'boot',
            env,
            script: scriptPath,
            argv: options.argv ?? [],
            cwd: process.cwd(),
            fs,
            thread: { threadId: this.threadId, workerData: options.workerData }
        } satisfies BackendBootMessage, [fs.service]);
        queueMicrotask(() => this.emit('online'));
    }

    postMessage(message: unknown): void {
        this.worker.postMessage({ kind: 'ipc', message } satisfies ParentToChildMessage);
    }

    terminate(): Promise<number> {
        this.end(1);
        return Promise.resolve(1);
    }

    ref(): void {}
    unref(): void {}

    private end(code: number): void {
        if(this.exited){
            return;
        }
        this.exited = true;
        forgetChildRoutes(this.worker);
        this.worker.terminate();
        this.emit('exit', code);
    }
}

const exportsObject = {
    isMainThread: true,
    parentPort: null as ParentPort | null,
    workerData: null as unknown,
    threadId: 0,
    resourceLimits: {},
    Worker,
    MessageChannel: globalThis.MessageChannel,
    MessagePort: globalThis.MessagePort,
    BroadcastChannel: globalThis.BroadcastChannel,
    enterThread,
    deliverToParentPort
};

export default exportsObject;
