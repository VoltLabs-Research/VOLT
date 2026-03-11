import { Duplex } from 'node:stream';
import { exec as nodeExec, spawn } from 'node:child_process';
import type { RuntimeTerminalAttachment, RuntimeTerminalExec } from '@/modules/platform/services';

class HostShellTerminalExec implements RuntimeTerminalExec {
    async resize(): Promise<void> {
        return Promise.resolve();
    }
}

class HostShellTerminalStream extends Duplex {
    constructor(private readonly childProcess: ReturnType<typeof spawn>) {
        super();

        this.childProcess.stdout?.on('data', (chunk: Buffer) => {
            this.push(chunk);
        });
        this.childProcess.stderr?.on('data', (chunk: Buffer) => {
            this.push(chunk);
        });
        this.childProcess.on('close', () => {
            this.push(null);
        });
        this.childProcess.on('error', (error) => {
            this.destroy(error);
        });
    }

    _read(): void {}

    _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        if (!this.childProcess.stdin) {
            callback(new Error('Host shell stdin is not available'));
            return;
        }

        this.childProcess.stdin.write(chunk, encoding, callback);
    }

    _final(callback: (error?: Error | null) => void): void {
        this.childProcess.stdin?.end();
        callback();
    }

    _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        if (!this.childProcess.killed) {
            this.childProcess.kill('SIGTERM');
        }

        callback(error);
    }
}

export class HostShellService {
    async attachTerminal(): Promise<RuntimeTerminalAttachment> {
        const shellPath = process.env.SHELL || '/bin/bash';
        const childProcess = spawn(shellPath, ['-i'], {
            cwd: process.env.HOME || '/',
            env: {
                ...process.env,
                TERM: 'xterm-256color'
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        return {
            stream: new HostShellTerminalStream(childProcess),
            exec: new HostShellTerminalExec()
        };
    }

    /**
     * Executes a shell command and resolves with its stdout output.
     *
     * @param command - The shell command string to execute.
     * @returns Stdout output of the command.
     * @throws If the command exits with a non-zero code.
     */
    exec(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            nodeExec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr?.trim() || error.message));
                    return;
                }

                resolve(stdout.trim());
            });
        });
    }
}
