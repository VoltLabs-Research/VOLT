import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';

interface RunOptions{
    cwd?: string;
    env?: Record<string, string>;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
    /** Hard ceiling on total runtime. The child is killed, not just abandoned. */
    timeoutMs?: number;
    /**
     * Give up when the child produces no output for this long.
     *
     * A package manager that has stopped making progress usually stops *talking*
     * long before any sensible hard ceiling expires — a winget install waiting on
     * a prompt that will never arrive is silent, not slow. Bounding silence is
     * what turns a half-hour hang into a reportable failure.
     */
    idleTimeoutMs?: number;
}

class ProcessTimeoutError extends Error{
    constructor(public readonly kind: 'timeout' | 'idle', message: string){
        super(message);
        this.name = 'ProcessTimeoutError';
    }
}

const KILL_GRACE = 3_000;

/**
 * Terminates a child *and everything it started*.
 *
 * `child.kill()` signals only the process it spawned. That is not enough for the
 * commands here: killing `winget` leaves the MSIX installer it launched running,
 * and killing a shell leaves its children reparented and alive. A timeout that
 * leaves the real work running is worse than no timeout, because the app reports
 * failure while the machine is still being modified underneath it.
 *
 * POSIX gets a process-group signal, which is why children are spawned detached —
 * that is what gives them their own group to signal. Windows has no process
 * groups to speak of, so it gets `taskkill /T`.
 */
const killTree = (child: ChildProcess, signal: NodeJS.Signals): void => {
    const pid = child.pid;
    if(pid === undefined) return;

    if(process.platform === 'win32'){
        /* /T = tree, /F = force. Only meaningful as a force kill, so SIGTERM is a no-op. */
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
        /* The group is already gone, or was never created; fall back to the child. */
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

/**
 * Spawns a command and resolves when it exits zero.
 *
 * Both timeouts terminate the child. The previous implementation raced the run
 * against a bare timer in the caller, which rejected the promise but left the
 * process alive — a hung installer kept running for the rest of the session
 * while the UI waited out the full ceiling.
 */
export const run = (bin: string, args: string[], options: RunOptions = {}) =>
    new Promise<void>((resolve, reject) => {
        const child = spawn(bin, args, {
            cwd: options.cwd,
            env: options.env ? {
                ...process.env,
                ...options.env
            } : process.env,
            shell: false,
            /*
             * Own process group on POSIX, so a timeout can signal the whole tree
             * rather than just this pid. Windows gets `taskkill /T` instead —
             * `detached` there would open a console window.
             */
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

        /* Ask the tree to stop, then insist. */
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
