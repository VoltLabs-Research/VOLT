import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

export interface RunOptions{
    cwd?: string;
    env?: Record<string, string>;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
}

const readLines = (stream: Readable, onLine?: (line: string) => void) => {
    if(!onLine) return () => {};

    let buf = '';
    stream.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8');
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for(const line of parts) onLine(line);
    });

    return () => {
        if(buf) onLine(buf);
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
            shell: false
        });

        const flushStdout = readLines(child.stdout, options.onStdout);
        const flushStderr = readLines(child.stderr, options.onStderr);

        child.on('error', reject);
        child.on('close', (code) => {
            flushStdout();
            flushStderr();
            if(code === 0) resolve();
            else reject(new Error(`${bin} ${args.join(' ')} exited ${code}`));
        });
    });
