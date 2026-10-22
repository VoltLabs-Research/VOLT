// Notebook kernels in this page: python3 processes serving notebooks (src/python/kernel.ts) in a file
// system of their own, where each workspace has a virtual environment and a working directory that
// its notebooks share, with the packages installed into the environment and the files they write.
// Kernels start one at a time: the first one of a workspace creates its environment and installs
// what every notebook of it can import.
import { createFsChannel, startFsService } from '../platform/fs/client';
import { forgetChildRoutes, handleChildLoopbackMessage } from '../platform/loopback';
import type { LoopbackConnectMessage, LoopbackListenMessage } from '../platform/loopback';
import { INPUT_ANSWERED, INPUT_CANCELLED, INPUT_DATA_BYTES, INPUT_HEADER_BYTES, SIGINT } from '../python/kernel-protocol';
import type { KernelMessage, KernelOutput, KernelRequest, KernelState } from '../python/kernel-protocol';
import type { BackendBootMessage, BackendWorkerMessage } from '../workers/protocol';

export type { KernelMessage, KernelOutput, KernelState };

export interface NotebookKernelOptions {
    // Where the runtime's built workers are served (scripts/build.mjs's dist).
    runtimeUrl: URL;
    // The workspace whose environment and files the kernel has: notebooks of one share them.
    workspace: string;
    // The kernel's environment variables besides the machine's (the notebook's credentials).
    env?: Record<string, string>;
    // What every notebook of the workspace can import, installed into its environment the first time.
    requirements?: string[];
}

// The kernel's messages, and its end: `failure` says why, unless it was shut down.
export type NotebookKernelEvent = KernelMessage | { type: 'exit'; failure: string | null };

export interface ExecuteReply {
    status: 'ok' | 'error' | 'aborted';
    executionCount: number | null;
}

export interface Completion {
    matches: string[];
    cursorStart: number;
    cursorEnd: number;
}

interface PendingRequest {
    receive(message: KernelMessage): void;
    fail(error: Error): void;
}

// The file system the kernels share, in its own directory of the origin's private file system.
const FILE_SYSTEM = 'volt-notebooks';
const HOME = '/home/volt';

export const workspaceDirectory = (workspace: string): string => `${HOME}/workspaces/${workspace}`;

let fileSystem: Promise<void> | null = null;
let starting: Promise<unknown> = Promise.resolve();
let nextRequest = 0;

type WorkerMessage = BackendWorkerMessage | LoopbackListenMessage | LoopbackConnectMessage;

export class NotebookKernel {
    state: KernelState | 'dead' = 'starting';
    // Why it ended, when it did other than by shutdown().
    failure: string | null = null;
    // Resolves when it serves requests; rejects if it never does.
    readonly ready: Promise<void>;
    private worker: Worker | null = null;
    private interruptBuffer: Int32Array | null = null;
    private inputControl: Int32Array | null = null;
    private inputData: Uint8Array | null = null;
    private readonly listeners = new Set<(event: NotebookKernelEvent) => void>();
    private readonly pending = new Map<string, PendingRequest>();
    private markReady: () => void = () => {};
    private markFailed: (error: Error) => void = () => {};

    constructor(private readonly options: NotebookKernelOptions){
        this.ready = new Promise<void>((resolve, reject) => {
            this.markReady = resolve;
            this.markFailed = reject;
        });
        // A failure reaches the listeners whether or not anyone waits for it to be ready.
        this.ready.catch(() => {});
        starting = starting.then(() => this.start()).then(() => this.ready).catch(() => {});
    }

    subscribe(listener: (event: NotebookKernelEvent) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    // Runs `code`, whose outputs are the messages with the id onStart is given. Executions queue.
    execute(code: string, onStart?: (id: string) => void): Promise<ExecuteReply> {
        const id = this.nextId();
        onStart?.(id);
        return this.request<ExecuteReply>({ type: 'execute', id, code }, (message) => (
            message.type === 'reply' ? { status: message.status, executionCount: message.executionCount } : null
        ));
    }

    complete(code: string, cursor: number): Promise<Completion> {
        return this.request<Completion>({ type: 'complete', id: this.nextId(), code, cursor }, (message) => (
            message.type === 'completion' ? { matches: message.matches, cursorStart: message.cursorStart, cursorEnd: message.cursorEnd } : null
        ));
    }

    // KeyboardInterrupt in the running execution, and no answer for the input() it waits on.
    interrupt(): void {
        if(this.interruptBuffer){
            Atomics.store(this.interruptBuffer, 0, SIGINT);
        }
        this.answer(INPUT_CANCELLED, 0);
    }

    // The answer to the input() the kernel waits on.
    answerInput(text: string): void {
        if(!this.inputData){
            return;
        }
        const bytes = new TextEncoder().encode(text).subarray(0, INPUT_DATA_BYTES);
        this.inputData.set(bytes);
        this.answer(INPUT_ANSWERED, bytes.byteLength);
    }

    shutdown(): void {
        this.end(null);
    }

    private nextId(): string {
        nextRequest += 1;
        return `request-${nextRequest}`;
    }

    private answer(state: number, length: number): void {
        if(!this.inputControl){
            return;
        }
        this.inputControl[1] = length;
        Atomics.store(this.inputControl, 0, state);
        Atomics.notify(this.inputControl, 0);
    }

    private request<T>(request: KernelRequest, replyOf: (message: KernelMessage) => T | null): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if(this.state === 'dead'){
                reject(new Error(this.failure ?? 'The kernel has shut down'));
                return;
            }
            this.pending.set(request.id, {
                receive: (message) => {
                    const reply = replyOf(message);
                    if(reply){
                        this.pending.delete(request.id);
                        resolve(reply);
                    }
                },
                fail: reject
            });
            // Requests made while it starts are sent once it serves them, in the order they were made.
            void this.ready.then(() => this.worker?.postMessage({ kind: 'ipc', message: request }), () => {});
        });
    }

    private emit(event: NotebookKernelEvent): void {
        for(const listener of this.listeners){
            listener(event);
        }
    }

    private receive(message: KernelMessage): void {
        if(message.type === 'ready'){
            this.interruptBuffer = message.interrupt;
            this.inputControl = new Int32Array(message.input, 0, 2);
            this.inputData = new Uint8Array(message.input, INPUT_HEADER_BYTES);
            this.markReady();
        }else if(message.type === 'status'){
            this.state = message.state;
        }
        this.emit(message);
        if(message.type === 'reply' || message.type === 'completion'){
            this.pending.get(message.id)?.receive(message);
        }
    }

    private async start(): Promise<void> {
        if(this.state === 'dead'){
            return;
        }
        try{
            fileSystem ??= startFsService(new URL('fs.worker.js', this.options.runtimeUrl), FILE_SYSTEM);
            await fileSystem;
        }catch(error){
            fileSystem = null;
            this.end(error instanceof Error ? error.message : String(error));
            return;
        }
        const directory = workspaceDirectory(this.options.workspace);
        const environment = `${directory}/.venv`;
        const worker = new Worker(new URL('python.worker.js', this.options.runtimeUrl), { type: 'module', name: 'notebook-kernel' });
        this.worker = worker;
        // What the interpreter prints outside the kernel's streams: a failure's explanation.
        let log = '';
        const decoder = new TextDecoder();
        worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
            const message = event.data;
            if(message.kind === 'listen' || message.kind === 'connect'){
                handleChildLoopbackMessage(worker, message, event.ports);
            }else if(message.kind === 'ipc'){
                this.receive(message.message as KernelMessage);
            }else if(message.kind === 'output'){
                log = (log + decoder.decode(message.chunk)).slice(-4000);
            }else if(message.kind === 'exit'){
                this.end(`The kernel exited with code ${message.code}${log ? `:\n${log}` : ''}`);
            }else if(message.kind === 'failed'){
                this.end(message.message);
            }
        });
        worker.addEventListener('error', (event) => this.end(event.message || 'The kernel failed to start'));
        const fs = createFsChannel();
        worker.postMessage({
            kind: 'boot',
            env: {
                HOME,
                PATH: `${environment}/bin:/usr/local/bin:/usr/bin:/bin`,
                VIRTUAL_ENV: environment,
                ...this.options.env
            },
            script: `${environment}/bin/python3`,
            argv: ['-m', 'volt_kernel', ...(this.options.requirements ?? [])],
            cwd: directory,
            fs,
            child: { serialization: 'advanced' }
        } satisfies BackendBootMessage, [fs.service]);
    }

    private end(failure: string | null): void {
        if(this.state === 'dead'){
            return;
        }
        this.state = 'dead';
        this.failure = failure;
        if(this.worker){
            forgetChildRoutes(this.worker);
            this.worker.terminate();
            this.worker = null;
        }
        const error = new Error(failure ?? 'The kernel has shut down');
        this.markFailed(error);
        for(const request of this.pending.values()){
            request.fail(error);
        }
        this.pending.clear();
        this.emit({ type: 'exit', failure });
    }
}
