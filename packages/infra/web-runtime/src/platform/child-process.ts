// Node's `child_process` for what the backends spawn. A Node program runs in its own worker, attached
// to the parent's file system and loopback network, with stdio pipes, an IPC channel, exit codes and
// signals as Node gives them: one the runtime ships a bundle for (the daemon's planes), or a script in
// the file system, run by `node` or by its `#!/usr/bin/env node` line as an executable is (programs
// compiled to WebAssembly for Node, such as analysis plugins). The runtime's other programs (python3)
// run the same way, from their executables or a script's #! line naming one. Anything else fails to
// spawn with ENOENT, as a missing binary does.
import { EventEmitter } from 'events';
import { PassThrough, Writable } from 'stream';
import pathModule from 'path';
import { BrowserWorker } from './browser-worker';
import { createFsChannel } from './fs/client';
import { closeSync, existsSync, openSync, readSync, statSync } from './fs';
import { errnoOf } from './os';
import { createPipe, PipeWriter } from './pipe';
import { forgetChildRoutes, handleChildLoopbackMessage } from './loopback';
import type { LoopbackConnectMessage, LoopbackListenMessage } from './loopback';
import type { BackendBootMessage, BackendWorkerMessage, ParentToChildMessage } from '../workers/protocol';

export interface SpawnedProgram {
    // Runs the spawned command, reporting its output and end through the ChildProcess.
    start(child: ChildProcess, options: SpawnOptions): void;
}

// Node programs the runtime ships a bundle for (scripts run with process.execPath), by path.
const nodePrograms = new Map<string, string | URL>();

// The worker that runs any other script of the file system.
let nodeRunner: string | URL | null = null;

export const registerNodeProgram = (scriptPath: string, workerUrl: string | URL): void => {
    nodePrograms.set(scriptPath, workerUrl);
};

export const registerNodeRunner = (workerUrl: string | URL): void => {
    nodeRunner = workerUrl;
};

// The runtime's programs besides Node, by name. A program's executable is a file whose first line
// names it: the runtime installs one on PATH, and copies of it run the same program under their own
// path (a virtual environment's interpreter is a copy of python3's).
const programs = new Map<string, string | URL>();

export const registerProgram = (name: string, workerUrl: string | URL): void => {
    programs.set(name, workerUrl);
};

export const programExecutable = (name: string): string => `#!@volt/web-runtime ${name}\n`;

const PROGRAM_LINE = /^#!@volt\/web-runtime\s+(\S+)/;

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

type StdioMode = 'pipe' | 'ignore' | 'inherit';

// Node's stdio option for descriptors 0-2. Descriptors of the parent's (0, 1, 2 or its streams)
// count as inherited; an IPC entry beyond them is what fork() adds.
const stdioModes = (stdio: unknown): [StdioMode, StdioMode, StdioMode] => {
    const modeOf = (entry: unknown, fd: number): StdioMode => {
        if(entry === undefined || entry === null || entry === 'pipe' || entry === 'overlapped'){
            return 'pipe';
        }
        if(entry === 'ignore'){
            return 'ignore';
        }
        if(entry === 'inherit' || entry === fd || entry === [process.stdin, process.stdout, process.stderr][fd]){
            return 'inherit';
        }
        throw Object.assign(new TypeError(`The stdio option for fd ${fd} is not supported in the browser: ${String(entry)}`), { code: 'ERR_INVALID_ARG_VALUE' });
    };
    const entries = Array.isArray(stdio) ? stdio : [stdio, stdio, stdio];
    return [modeOf(entries[0], 0), modeOf(entries[1], 1), modeOf(entries[2], 2)];
};

// Whether a process gets an IPC channel: its stdio option has an 'ipc' entry, as fork()'s has.
const hasIpc = (stdio: unknown): boolean => Array.isArray(stdio) && stdio.includes('ipc');

const SIGNAL_NUMBERS: Record<string, number> = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGKILL: 9, SIGUSR1: 10, SIGUSR2: 12, SIGTERM: 15 };

let nextPid = 100;

interface ChildHandlers {
    kill: (signal: string) => void;
    send?: (message: unknown) => void;
    disconnect?: () => void;
    stdin?: { write(chunk: Uint8Array): void; end(): void };
}

export class ChildProcess extends EventEmitter {
    readonly pid: number;
    // As in Node, a stream exists for each descriptor spawned with 'pipe', and is null otherwise.
    readonly stdin: Writable | null;
    readonly stdout: PassThrough | null;
    readonly stderr: PassThrough | null;
    readonly stdio: [Writable | null, PassThrough | null, PassThrough | null];
    readonly spawnfile: string;
    readonly spawnargs: string[];
    exitCode: number | null = null;
    signalCode: string | null = null;
    killed = false;
    connected = false;
    private handlers: ChildHandlers = { kill: () => {} };
    // What is written to stdin before the program starts, as a pipe holds it until read.
    private pendingStdin: Uint8Array[] | null = [];
    private stdinEnded = false;
    // What is sent before the program starts, which its IPC channel holds until it reads it.
    private pendingMessages: unknown[] | null = [];

    constructor(command: string, args: string[], private readonly modes: [StdioMode, StdioMode, StdioMode], ipc: boolean){
        super();
        nextPid += 1;
        this.pid = nextPid;
        this.spawnfile = command;
        this.spawnargs = [command, ...args];
        this.connected = ipc;
        this.stdin = modes[0] === 'pipe'
            ? new Writable({
                write: (chunk: Buffer, _encoding, callback) => {
                    this.writeStdin(chunk);
                    callback();
                },
                final: (callback) => {
                    this.endStdin();
                    callback();
                }
            })
            : null;
        this.stdout = modes[1] === 'pipe' ? new PassThrough() : null;
        this.stderr = modes[2] === 'pipe' ? new PassThrough() : null;
        this.stdio = [this.stdin, this.stdout, this.stderr];
    }

    bind(handlers: ChildHandlers): void {
        this.handlers = handlers;
        const pending = this.pendingStdin ?? [];
        this.pendingStdin = null;
        for(const chunk of pending){
            handlers.stdin?.write(chunk);
        }
        if(this.stdinEnded){
            handlers.stdin?.end();
        }
        const messages = this.pendingMessages ?? [];
        this.pendingMessages = null;
        if(this.connected){
            for(const message of messages){
                handlers.send?.(message);
            }
        }
    }

    private writeStdin(chunk: Uint8Array): void {
        if(this.pendingStdin){
            this.pendingStdin.push(chunk);
        }else{
            this.handlers.stdin?.write(chunk);
        }
    }

    private endStdin(): void {
        this.stdinEnded = true;
        if(!this.pendingStdin){
            this.handlers.stdin?.end();
        }
    }

    // What the program writes to its stdout (1) or stderr (2), wherever that descriptor goes.
    output(fd: 1 | 2, chunk: Uint8Array): void {
        const mode = this.modes[fd];
        if(mode === 'pipe'){
            (fd === 1 ? this.stdout : this.stderr)?.write(chunk);
        }else if(mode === 'inherit'){
            (fd === 1 ? process.stdout : process.stderr).write(chunk);
        }
    }

    kill(signal: string | number = 'SIGTERM'): boolean {
        if(this.exitCode !== null || this.signalCode !== null){
            return false;
        }
        this.killed = true;
        this.handlers.kill(typeof signal === 'number' ? Object.keys(SIGNAL_NUMBERS).find((name) => SIGNAL_NUMBERS[name] === signal) ?? 'SIGTERM' : signal);
        return true;
    }

    send(message: unknown, ...rest: unknown[]): boolean {
        const callback = rest.find((arg): arg is (error: Error | null) => void => typeof arg === 'function');
        if(!this.connected){
            const error = Object.assign(new Error('Channel closed'), { code: 'ERR_IPC_CHANNEL_CLOSED' });
            queueMicrotask(() => callback ? callback(error) : this.emit('error', error));
            return false;
        }
        if(this.pendingMessages){
            this.pendingMessages.push(message);
        }else{
            this.handlers.send?.(message);
        }
        callback?.(null);
        return true;
    }

    disconnect(): void {
        if(!this.connected){
            return;
        }
        this.connected = false;
        this.handlers.disconnect?.();
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
        this.stdout?.end();
        this.stderr?.end();
        this.emit('exit', code, signal);
        queueMicrotask(() => this.emit('close', code, signal));
    }

    failToSpawn(error: Error): void {
        queueMicrotask(() => {
            this.emit('error', error);
            this.stdout?.end();
            this.stderr?.end();
            this.emit('close', -2, null);
        });
    }
}

const SIGNAL_GRACE_MS = 5_000;

const serialize = (message: unknown, serialization: 'json' | 'advanced'): unknown => (
    serialization === 'advanced' ? message : JSON.parse(JSON.stringify(message))
);

const encoder = new TextEncoder();

// A Node program in its own worker, running `script` (argv[1] of its process) with `argv` after it.
const nodeProgram = (workerUrl: string | URL, script: string, argv: string[]): SpawnedProgram => ({
    start(child, options){
        const worker = new BrowserWorker(workerUrl, { type: 'module', name: pathModule.basename(script) });
        const serialization = options.serialization ?? 'json';
        const stdin = child.stdin ? createPipe() : undefined;
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
            disconnect: () => worker.postMessage({ kind: 'disconnect' } satisfies ParentToChildMessage),
            stdin: stdin ? new PipeWriter(stdin) : undefined
        });
        worker.addEventListener('message', (event: MessageEvent<BackendWorkerMessage | LoopbackListenMessage | LoopbackConnectMessage>) => {
            const message = event.data;
            if(message.kind === 'listen' || message.kind === 'connect'){
                handleChildLoopbackMessage(worker, message, event.ports);
            }else if(message.kind === 'ipc'){
                child.emit('message', message.message);
            }else if(message.kind === 'output'){
                child.output(message.stream === 'stdout' ? 1 : 2, message.chunk);
            }else if(message.kind === 'exit'){
                end(message.code, null);
            }else if(message.kind === 'failed'){
                child.output(2, encoder.encode(`${message.message}\n`));
                end(1, null);
            }
        });
        worker.addEventListener('error', (event) => {
            child.output(2, encoder.encode(`${event.message}\n`));
            end(1, null);
        });
        const env = Object.fromEntries(Object.entries(options.env ?? process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
        const fs = createFsChannel();
        worker.postMessage({
            kind: 'boot',
            env,
            script,
            argv,
            cwd: options.cwd ?? process.cwd(),
            fs,
            child: { serialization, stdin }
        } satisfies BackendBootMessage, [fs.service]);
    }
});

const isFile = (file: string): boolean => {
    try{
        return statSync(file)?.isFile() ?? false;
    }catch{
        return false;
    }
};

// The worker that runs the Node program at `script`: its bundle, or the runner for a script of the
// file system.
export const nodeWorkerFor = (script: string): string | URL | null => {
    const resolved = pathModule.resolve(process.cwd(), script);
    return nodePrograms.get(resolved) ?? (nodeRunner && isFile(resolved) ? nodeRunner : null);
};

const firstLine = (file: string): string => {
    const head = new Uint8Array(256);
    const fd = openSync(file, 'r');
    try{
        const count = readSync(fd, head, 0, head.length, 0);
        return new TextDecoder().decode(head.subarray(0, count)).split('\n', 1)[0];
    }finally{
        closeSync(fd);
    }
};

// The interpreter a script's #! line names, as the kernel reads it: a path, or a command
// `/usr/bin/env` finds on PATH.
const INTERPRETER_LINE = /^#!\s*(\S+)(?:\s+(?:-S\s+)?(\S+))?/;

// A command as the shell finds it: a path, or the first match among the PATH directories.
const findExecutable = (command: string, options: SpawnOptions): string | null => {
    const cwd = options.cwd ?? process.cwd();
    if(command.includes('/')){
        const file = pathModule.resolve(cwd, command);
        return isFile(file) ? file : null;
    }
    for(const directory of ((options.env ?? process.env).PATH ?? '').split(':').filter(Boolean)){
        const file = pathModule.resolve(cwd, directory, command);
        if(existsSync(file) && isFile(file)){
            return file;
        }
    }
    return null;
};

const isNodeCommand = (command: string): boolean => command === process.execPath || pathModule.basename(command) === 'node';

// The worker of a program's executable, when the file is one.
const programAt = (executable: string): string | URL | null => {
    const name = PROGRAM_LINE.exec(firstLine(executable))?.[1];
    return (name && programs.get(name)) ?? null;
};

const resolveProgram = (command: string, args: string[], options: SpawnOptions): SpawnedProgram | null => {
    if(isNodeCommand(command)){
        const script = args[0] && pathModule.resolve(options.cwd ?? process.cwd(), args[0]);
        const workerUrl = script ? nodeWorkerFor(script) : null;
        return script && workerUrl ? nodeProgram(workerUrl, script, args.slice(1)) : null;
    }
    const executable = findExecutable(command, options);
    if(!executable){
        return null;
    }
    const program = programAt(executable);
    if(program){
        return nodeProgram(program, executable, args);
    }
    // A script runs as its interpreter's argument, as the kernel runs it.
    const [, interpreterPath, envCommand] = INTERPRETER_LINE.exec(firstLine(executable)) ?? [];
    const interpreter = interpreterPath && pathModule.basename(interpreterPath) === 'env' ? envCommand : interpreterPath;
    if(!interpreter){
        return null;
    }
    if(isNodeCommand(interpreter)){
        return nodeRunner ? nodeProgram(nodeRunner, executable, args) : null;
    }
    const interpreterExecutable = findExecutable(interpreter, options);
    const interpreterProgram = interpreterExecutable ? programAt(interpreterExecutable) : null;
    return interpreterExecutable && interpreterProgram ? nodeProgram(interpreterProgram, interpreterExecutable, [executable, ...args]) : null;
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
    const child = new ChildProcess(command, args, stdioModes(options.stdio), hasIpc(options.stdio));
    const program = resolveProgram(command, args, options);
    if(!program){
        child.failToSpawn(spawnError(command));
        return child;
    }
    options.signal?.addEventListener('abort', () => child.kill('SIGTERM'));
    queueMicrotask(() => {
        child.emit('spawn');
        program.start(child, options);
    });
    return child;
};

// As Node's: the child inherits the parent's stdio (or pipes it, silent) and has an IPC channel.
export const fork = (modulePath: string, args: readonly string[] = [], options: SpawnOptions & { silent?: boolean } = {}): ChildProcess => (
    spawn(process.execPath, [modulePath, ...args], {
        ...options,
        stdio: options.stdio ?? (options.silent ? ['pipe', 'pipe', 'pipe', 'ipc'] : [0, 1, 2, 'ipc'])
    })
);

type ExecCallback = (error: (Error & { code?: number | string }) | null, stdout: string, stderr: string) => void;

export const execFile = (file: string, argsOrCallback?: readonly string[] | ExecCallback, optionsOrCallback?: SpawnOptions | ExecCallback, maybeCallback?: ExecCallback): ChildProcess => {
    const args = Array.isArray(argsOrCallback) ? argsOrCallback : [];
    const callback = [argsOrCallback, optionsOrCallback, maybeCallback].find((arg): arg is ExecCallback => typeof arg === 'function');
    const options = typeof optionsOrCallback === 'object' ? optionsOrCallback : {};
    const child = spawn(file, args, { ...options, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
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
