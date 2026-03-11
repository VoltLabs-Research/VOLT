import { registerProcess, unregisterProcess } from './processTracker';
import { spawn } from 'node:child_process';

export interface ProcessResult {
    code: number;
    stdout: string;
    stderr: string;
};

export interface BinaryExecutorService {
    executeProcess(jobId: string, binaryPath: string, args: string[], cwd: string): Promise<ProcessResult>;
};

export const createBinaryExecutorService = (): BinaryExecutorService => ({
    executeProcess(jobId, binaryPath, args, cwd) {
        return new Promise((resolve, reject) => {
            const child = spawn(binaryPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env }
            });
            registerProcess(jobId, child);

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
            child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

            child.on('error', (error) => {
                unregisterProcess(jobId);
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', (code) => {
                unregisterProcess(jobId);
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: Buffer.concat(stderrChunks).toString('utf-8')
                });
            });
        });
    }
});
