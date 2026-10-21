// The `process` global the backends read: env, argv, stdout/stderr, nextTick, hrtime and the events
// they subscribe to. exit() is reported to the host page, which owns the worker's lifetime.
import { EventEmitter } from 'events';
import { constants as fsConstants } from './fs/constants';
import { constants as osConstants } from './os';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const bytesOf = (chunk: string | Uint8Array, encoding: unknown): Uint8Array => {
    if(typeof chunk !== 'string'){
        return chunk;
    }
    const NodeBuffer = (globalThis as { Buffer?: { from(value: string, encoding?: string): Uint8Array } }).Buffer;
    return NodeBuffer && typeof encoding === 'string' ? NodeBuffer.from(chunk, encoding) : encoder.encode(chunk);
};

// process.stdout/stderr: the console, line by line, until a parent takes the bytes (redirect()).
// An EventEmitter rather than a stream.Writable: `stream` itself reads this module's `process`.
class OutputStream extends EventEmitter {
    readonly isTTY = false;
    readonly writable = true;
    columns = 120;
    private pending = '';
    private sink: ((chunk: Uint8Array) => void) | null = null;

    constructor(readonly fd: number, private readonly log: (line: string) => void){
        super();
    }

    redirect(sink: (chunk: Uint8Array) => void): void {
        this.sink = sink;
    }

    write(chunk: string | Uint8Array, encodingOrCallback?: unknown, callback?: () => void): boolean {
        const bytes = bytesOf(chunk, encodingOrCallback);
        if(this.sink){
            this.sink(bytes);
        }else{
            this.pending += decoder.decode(bytes, { stream: true });
            const lines = this.pending.split('\n');
            this.pending = lines.pop() ?? '';
            for(const line of lines){
                this.log(line);
            }
        }
        const done = typeof encodingOrCallback === 'function' ? encodingOrCallback as () => void : callback;
        done?.();
        return true;
    }

    end(chunk?: string | Uint8Array): this {
        if(chunk){
            this.write(chunk);
        }
        this.emit('finish');
        return this;
    }

    cork(): void {}
    uncork(): void {}
}

const startedAt = performance.now();

const hrtime = (previous?: [number, number]): [number, number] => {
    const now = performance.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = Math.floor((now % 1000) * 1e6);
    if(!previous){
        return [seconds, nanoseconds];
    }
    const deltaNanoseconds = nanoseconds - previous[1];
    return deltaNanoseconds < 0
        ? [seconds - previous[0] - 1, deltaNanoseconds + 1e9]
        : [seconds - previous[0], deltaNanoseconds];
};
hrtime.bigint = (): bigint => BigInt(Math.floor(performance.now() * 1e6));

class BrowserProcess extends EventEmitter {
    title = 'volt';
    env: Record<string, string | undefined> = {};
    argv = ['/usr/local/bin/node', '/app/index.js'];
    execArgv: string[] = [];
    execPath = '/usr/local/bin/node';
    // Platform-specific branches in the backends pick their POSIX paths; the daemon reports the
    // architecture it runs plugins for from `arch`.
    platform = 'linux';
    arch = 'wasm32';
    version = 'v22.12.0';
    versions = { node: '22.12.0', v8: '12.4', uv: '1.48.0', modules: '127' };
    release = { name: 'node' };
    pid = 1;
    ppid = 0;
    exitCode: number | undefined = undefined;
    stdout = new OutputStream(1, (line) => console.log(line));
    stderr = new OutputStream(2, (line) => console.error(line));
    // A stream.Readable the worker entry installs (src/workers/stdin.ts), which `stream` needs first.
    stdin: unknown = null;
    hrtime = hrtime;
    browser = true;
    private workingDirectory = '/app';
    onExit: (code: number) => void = () => {};
    private exiting = false;
    // Present only in a spawned process, as in Node, where process.send exists only with an IPC channel.
    send?: (message: unknown, ...rest: unknown[]) => boolean;
    connected = false;

    // A spawned process writes its output to the parent's pipes instead of the console.
    redirectOutput(write: (stream: 'stdout' | 'stderr', chunk: Uint8Array) => void): void {
        this.stdout.redirect((chunk) => write('stdout', chunk));
        this.stderr.redirect((chunk) => write('stderr', chunk));
    }

    disconnect(): void {
        this.connected = false;
        this.emit('disconnect');
    }

    cwd(): string {
        return this.workingDirectory;
    }

    chdir(directory: string): void {
        this.workingDirectory = directory;
    }

    nextTick(callback: (...args: unknown[]) => void, ...args: unknown[]): void {
        queueMicrotask(() => callback(...args));
    }

    uptime(): number {
        return (performance.now() - startedAt) / 1000;
    }

    memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number; arrayBuffers: number } {
        const memory = (performance as Performance & { memory?: { totalJSHeapSize: number; usedJSHeapSize: number } }).memory;
        const heapTotal = memory?.totalJSHeapSize ?? 0;
        const heapUsed = memory?.usedJSHeapSize ?? 0;
        return { rss: heapTotal, heapTotal, heapUsed, external: 0, arrayBuffers: 0 };
    }

    cpuUsage(): { user: number; system: number } {
        return { user: Math.floor(performance.now() * 1000), system: 0 };
    }

    resourceUsage(): { maxRSS: number } {
        return { maxRSS: this.memoryUsage().rss / 1024 };
    }

    emitWarning(warning: string | Error): void {
        console.warn(warning);
    }

    umask(): number {
        return 0o22;
    }

    getuid(): number {
        return 1000;
    }

    getgid(): number {
        return 1000;
    }

    kill(pid: number): boolean {
        if(pid !== this.pid){
            throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
        }
        return true;
    }

    // Ends the program; a second call while it unwinds (an 'exit' listener, a runtime exiting again)
    // only unwinds further, as the process is already gone in Node.
    exit(code = this.exitCode ?? 0): never {
        if(!this.exiting){
            this.exiting = true;
            this.exitCode = code;
            this.emit('exit', code);
            this.onExit(code);
        }
        throw Object.assign(new Error(`process.exit(${code})`), { name: 'ProcessExit', code });
    }

    abort(): never {
        return this.exit(134);
    }

    // Node keeps the deprecated `constants` binding for code that reads open(2) flags from it
    // (Emscripten's NODERAWFS does); there are no other bindings without Node's C++ side.
    binding(name: string): unknown {
        if(name === 'constants'){
            return { fs: fsConstants, os: osConstants };
        }
        throw new Error(`No such module: ${name}`);
    }
}

const browserProcess = new BrowserProcess();

export default browserProcess;
