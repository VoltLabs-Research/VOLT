// The `process` global the backends read: env, argv, stdout/stderr, nextTick, hrtime and the events
// they subscribe to. exit() is reported to the host page, which owns the worker's lifetime.
import { EventEmitter } from 'events';

interface ProcessStream {
    fd: number;
    isTTY: false;
    columns: number;
    write(chunk: string | Uint8Array, encodingOrCallback?: unknown, callback?: () => void): boolean;
    on(): ProcessStream;
    once(): ProcessStream;
    end(): void;
}

const decoder = new TextDecoder();

const createStream = (fd: number, sink: (line: string) => void): ProcessStream => {
    let pending = '';
    const stream: ProcessStream = {
        fd,
        isTTY: false,
        columns: 120,
        write(chunk, encodingOrCallback, callback){
            pending += typeof chunk === 'string' ? chunk : decoder.decode(chunk);
            const lines = pending.split('\n');
            pending = lines.pop() ?? '';
            for(const line of lines){
                sink(line);
            }
            const done = typeof encodingOrCallback === 'function' ? encodingOrCallback as () => void : callback;
            done?.();
            return true;
        },
        on: () => stream,
        once: () => stream,
        end: () => {}
    };
    return stream;
};

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
    stdout = createStream(1, (line) => console.log(line));
    stderr = createStream(2, (line) => console.error(line));
    stdin = createStream(0, () => {});
    hrtime = hrtime;
    browser = true;
    private workingDirectory = '/app';
    onExit: (code: number) => void = () => {};

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

    exit(code = this.exitCode ?? 0): never {
        this.emit('exit', code);
        this.onExit(code);
        throw Object.assign(new Error(`process.exit(${code})`), { name: 'ProcessExit', code });
    }

    abort(): never {
        return this.exit(134);
    }

    binding(): never {
        throw new Error('process.binding is not supported');
    }
}

const browserProcess = new BrowserProcess();

export default browserProcess;
