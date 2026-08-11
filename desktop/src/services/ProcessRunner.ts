import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';

interface RunOptions{
    cwd?: string;
    env?: Record<string, string>;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;

    timeoutMs?: number;

    idleTimeoutMs?: number;
}

class ProcessTimeoutError extends Error{
    constructor(public readonly kind: 'timeout' | 'idle', message: string){
        super(message);
        this.name = 'ProcessTimeoutError';
    }
}

const KILL_GRACE = 3_000;

const killTree = (child: ChildProcess, signal: NodeJS.Signals): void => {
    const pid = child.pid;
    if(pid === undefined) return;

    if(process.platform === 'win32'){
        if(signal !== 'SIGKILL') return;
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
            shell: false,
            windowsHide: true,
            stdio: 'ignore'
        }).on('error', () => { /* the process may already be gone */ });
        return;
    }

    try{
        process.kill(-pid, signal);
    }catch{
        try{ child.kill(signal); }catch{ /* already dead */ }
    }
};

const readLines = (stream: Readable, onLine?: (line: string) => void, onActivity?: () => void) => {
    let buf = '';
    stream.on('data', (chunk: Buffer) => {
        onActivity?.();
        if(!onLine) return;
        buf += chunk.toString('utf8');
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for(const line of parts) onLine(line);
    });

    return () => {
        if(buf && onLine) onLine(buf);
    };
};

export const run = (bin: string, args: string[], options: RunOptions = {}) =>
    new Promise<void>((resolve, reject) => {
        const child = spawn(bin, args, {
            cwd: options.cwd,
            env: options.env ? {
                ...process.env,
                ...options.env
            } : process.env,
            shell: false,

            detached: process.platform !== 'win32',
            windowsHide: true
        });

        let settled = false;
        let hardTimer: NodeJS.Timeout | undefined;
        let idleTimer: NodeJS.Timeout | undefined;

        const clearTimers = (): void => {
            if(hardTimer) clearTimeout(hardTimer);
            if(idleTimer) clearTimeout(idleTimer);
        };

        const settle = (fn: () => void): void => {
            if(settled) return;
            settled = true;
            clearTimers();
            fn();
        };

        const terminate = (): void => {
            killTree(child, 'SIGTERM');
            setTimeout(() => killTree(child, 'SIGKILL'), KILL_GRACE).unref();
        };

        const armIdle = (): void => {
            if(!options.idleTimeoutMs) return;
            if(idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                settle(() => {
                    terminate();
                    reject(new ProcessTimeoutError(
                        'idle',
                        `${bin} produced no output for ${Math.round(options.idleTimeoutMs! / 1000)}s`
                    ));
                });
            }, options.idleTimeoutMs);
            idleTimer.unref();
        };

        const flushStdout = readLines(child.stdout, options.onStdout, armIdle);
        const flushStderr = readLines(child.stderr, options.onStderr, armIdle);

        if(options.timeoutMs){
            hardTimer = setTimeout(() => {
                settle(() => {
                    terminate();
                    reject(new ProcessTimeoutError(
                        'timeout',
                        `${bin} timed out after ${Math.round(options.timeoutMs! / 1000)}s`
                    ));
                });
            }, options.timeoutMs);
            hardTimer.unref();
        }
        armIdle();

        child.on('error', (err) => settle(() => reject(err)));
        child.on('close', (code) => settle(() => {
            flushStdout();
            flushStderr();
            if(code === 0) resolve();
            else reject(new Error(`${bin} ${args.join(' ')} exited ${code}`));
        }));
    });
