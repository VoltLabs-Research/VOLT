// Node's `child_process` for what the backends spawn. A Node program the runtime ships a worker for
// (the daemon's planes) runs in its own worker, attached to the parent's file system and loopback
// network, with stdout/stderr pipes, an IPC channel, exit codes and signals as Node gives them.
// Executables are looked up among the registered ones; anything else fails to spawn with ENOENT,
// as a missing binary does.
import { EventEmitter } from 'events';
import { PassThrough, Writable } from 'stream';
import pathModule from 'path';
import { BrowserWorker } from './browser-worker';
import { createFsChannel } from './fs/client';
import { errnoOf } from './os';
import { forgetChildRoutes, handleChildLoopbackMessage } from './loopback';
import type { LoopbackConnectMessage, LoopbackListenMessage } from './loopback';
import type { BackendBootMessage, BackendWorkerMessage, ParentToChildMessage } from '../workers/protocol';

export interface SpawnedProgram {
    // Runs the spawned command, reporting its output and end through the ChildProcess.
    start(child: ChildProcess, args: string[], options: SpawnOptions): void;
}

export type ExecutableResolver = (command: string) => SpawnedProgram | null;

const resolvers: ExecutableResolver[] = [];

// Node programs (scripts run with process.execPath) and the worker that runs each.
const nodePrograms = new Map<string, string | URL>();

export const registerNodeProgram = (scriptPath: string, workerUrl: string | URL): void => {
    nodePrograms.set(scriptPath, workerUrl);
};

export const registerExecutableResolver = (resolver: ExecutableResolver): void => {
    resolvers.push(resolver);
};

export interface SpawnOptions {
    cwd?: string;
    env?: Record<string, string | undefined>;
    stdio?: unknown;
    serialization?: 'json' | 'advanced';
    signal?: AbortSignal;
    detached?: boolean;
    windowsHide?: boolean;
    shell?: boolean | string;
    timeout?: number;
}

const SIGNAL_NUMBERS: Record<string, number> = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGKILL: 9, SIGUSR1: 10, SIGUSR2: 12, SIGTERM: 15 };

let nextPid = 100;

export class ChildProcess extends EventEmitter {
    readonly pid: number;
    readonly stdin: Writable;
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    readonly stdio: [Writable, PassThrough, PassThrough];
    readonly spawnfile: string;
    readonly spawnargs: string[];
    exitCode: number | null = null;
    signalCode: string | null = null;
    killed = false;
    connected = false;
    private onKill: (signal: string) => void = () => {};
    private onSend: ((message: unknown) => void) | null = null;
    private onDisconnect: () => void = () => {};

    constructor(command: string, args: string[], stdinWrite: (chunk: Buffer) => void = () => {}){
        super();
        nextPid += 1;
        this.pid = nextPid;
        this.spawnfile = command;
        this.spawnargs = [command, ...args];
        this.stdin = new Writable({
            write(chunk: Buffer, _encoding, callback){
                stdinWrite(chunk);
                callback();
            }
        });
        this.stdio = [this.stdin, this.stdout, this.stderr];
    }

    bind(handlers: { kill: (signal: string) => void; send?: (message: unknown) => void; disconnect?: () => void }): void {
        this.onKill = handlers.kill;
        if(handlers.send){
            this.onSend = handlers.send;
            this.connected = true;
        }
        if(handlers.disconnect){
            this.onDisconnect = handlers.disconnect;
        }
    }

    kill(signal: string | number = 'SIGTERM'): boolean {
        if(this.exitCode !== null || this.signalCode !== null){
            return false;
        }
        this.killed = true;
        this.onKill(typeof signal === 'number' ? Object.keys(SIGNAL_NUMBERS).find((name) => SIGNAL_NUMBERS[name] === signal) ?? 'SIGTERM' : signal);
        return true;
    }

    send(message: unknown, ...rest: unknown[]): boolean {
        const callback = rest.find((arg): arg is (error: Error | null) => void => typeof arg === 'function');
        if(!this.onSend || !this.connected){
            const error = Object.assign(new Error('Channel closed'), { code: 'ERR_IPC_CHANNEL_CLOSED' });
            queueMicrotask(() => callback ? callback(error) : this.emit('error', error));
            return false;
        }
        this.onSend(message);
        callback?.(null);
        return true;
    }

    disconnect(): void {
        if(!this.connected){
            return;
        }
        this.connected = false;
        this.onDisconnect();
        this.emit('disconnect');
    }

    ref(): this { return this; }
    unref(): this { return this; }

    // Called by the program when it ends.
    finish(code: number | null, signal: string | null): void {
        if(this.exitCode !== null || this.signalCode !== null){
            return;
        }
        this.exitCode = code;
        this.signalCode = signal;
        this.connected = false;
        this.stdout.end();
        this.stderr.end();
        this.emit('exit', code, signal);
        queueMicrotask(() => this.emit('close', code, signal));
    }

    failToSpawn(error: Error): void {
        queueMicrotask(() => {
            this.emit('error', error);
            this.stdout.end();
            this.stderr.end();
            this.emit('close', -2, null);
        });
    }
}

const SIGNAL_GRACE_MS = 5_000;

const serialize = (message: unknown, serialization: 'json' | 'advanced'): unknown => (
    serialization === 'advanced' ? message : JSON.parse(JSON.stringify(message))
);

const nodeProgram = (workerUrl: string | URL): SpawnedProgram => ({
    start(child, args, options){
        const worker = new BrowserWorker(workerUrl, { type: 'module', name: pathModule.basename(child.spawnargs[1] ?? 'node') });
        const serialization = options.serialization ?? 'json';
        let exited = false;
        const end = (code: number | null, signal: string | null): void => {
            if(exited){
                return;
            }
            exited = true;
            forgetChildRoutes(worker);
            worker.terminate();
            child.finish(code, signal);
        };
        child.bind({
            kill: (signal) => {
                worker.postMessage({ kind: 'signal', signal } satisfies ParentToChildMessage);
                if(signal === 'SIGKILL'){
                    end(null, signal);
                    return;
                }
                setTimeout(() => end(null, signal), SIGNAL_GRACE_MS);
            },
            send: (message) => worker.postMessage({ kind: 'ipc', message: serialize(message, serialization) } satisfies ParentToChildMessage),
            disconnect: () => worker.postMessage({ kind: 'disconnect' } satisfies ParentToChildMessage)
        });
        worker.addEventListener('message', (event: MessageEvent<BackendWorkerMessage | LoopbackListenMessage | LoopbackConnectMessage>) => {
            const message = event.data;
            if(message.kind === 'listen' || message.kind === 'connect'){
                handleChildLoopbackMessage(worker, message, event.ports);
            }else if(message.kind === 'ipc'){
                child.emit('message', message.message);
            }else if(message.kind === 'output'){
                (message.stream === 'stdout' ? child.stdout : child.stderr).write(message.text);
            }else if(message.kind === 'exit'){
                end(message.code, null);
            }else if(message.kind === 'failed'){
                child.stderr.write(`${message.message}\n`);
                end(1, null);
            }
        });
        worker.addEventListener('error', (event) => {
            child.stderr.write(`${event.message}\n`);
            end(1, null);
        });
        const env = Object.fromEntries(Object.entries(options.env ?? process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
        worker.postMessage({
            kind: 'boot',
            env,
            argv: args.slice(1),
            cwd: options.cwd ?? process.cwd(),
            fs: { channel: createFsChannel() },
            child: { serialization }
        } satisfies BackendBootMessage);
    }
});

export const resolveNodeProgram = (scriptPath: string): string | URL | undefined => (
    nodePrograms.get(pathModule.resolve(process.cwd(), scriptPath))
);

const resolveProgram = (command: string, args: string[]): SpawnedProgram | null => {
    const isNode = command === process.execPath || pathModule.basename(command) === 'node';
    if(isNode && args[0]){
        const workerUrl = resolveNodeProgram(args[0]);
        return workerUrl ? nodeProgram(workerUrl) : null;
    }
    for(const resolver of resolvers){
        const program = resolver(command);
        if(program){
            return program;
        }
    }
    return null;
};

const spawnError = (command: string): Error => Object.assign(new Error(`spawn ${command} ENOENT`), {
    code: 'ENOENT',
    errno: errnoOf('ENOENT'),
    syscall: `spawn ${command}`,
    path: command
});

export const spawn = (command: string, argsOrOptions?: readonly string[] | SpawnOptions, maybeOptions?: SpawnOptions): ChildProcess => {
    const args = Array.isArray(argsOrOptions) ? [...argsOrOptions] : [];
    const options = (Array.isArray(argsOrOptions) ? maybeOptions : argsOrOptions as SpawnOptions | undefined) ?? {};
    const program = resolveProgram(command, args);
    const child = new ChildProcess(command, args);
    if(!program){
        child.failToSpawn(spawnError(command));
        return child;
    }
    options.signal?.addEventListener('abort', () => child.kill('SIGTERM'));
    queueMicrotask(() => {
        child.emit('spawn');
        program.start(child, args, options);
    });
    return child;
};

export const fork = (modulePath: string, args: readonly string[] = [], options: SpawnOptions = {}): ChildProcess => (
    spawn(process.execPath, [modulePath, ...args], options)
);

type ExecCallback = (error: (Error & { code?: number | string }) | null, stdout: string, stderr: string) => void;

export const execFile = (file: string, argsOrCallback?: readonly string[] | ExecCallback, optionsOrCallback?: SpawnOptions | ExecCallback, maybeCallback?: ExecCallback): ChildProcess => {
    const args = Array.isArray(argsOrCallback) ? argsOrCallback : [];
    const callback = [argsOrCallback, optionsOrCallback, maybeCallback].find((arg): arg is ExecCallback => typeof arg === 'function');
    const options = typeof optionsOrCallback === 'object' ? optionsOrCallback : {};
    const child = spawn(file, args, options);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', (error: Error) => callback?.(error, stdout, stderr));
    child.on('close', (code: number | null) => {
        if(code === -2){
            return;
        }
        callback?.(code === 0 ? null : Object.assign(new Error(`Command failed: ${file} ${args.join(' ')}\n${stderr}`), { code: code ?? 1 }), stdout, stderr);
    });
    return child;
};

export const exec = (command: string, optionsOrCallback?: SpawnOptions | ExecCallback, maybeCallback?: ExecCallback): ChildProcess => {
    const [file, ...args] = command.split(/\s+/).filter(Boolean);
    return execFile(file, args, optionsOrCallback as SpawnOptions, maybeCallback);
};

const unsupportedSync = (name: string) => (): never => {
    throw Object.assign(new Error(`child_process.${name} is not available in the browser`), { code: 'ENOSYS' });
};

export const spawnSync = unsupportedSync('spawnSync');
export const execSync = unsupportedSync('execSync');
export const execFileSync = unsupportedSync('execFileSync');

export default { ChildProcess, spawn, fork, exec, execFile, spawnSync, execSync, execFileSync };
