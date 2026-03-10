import { RedisConnectionService } from '../../infrastructure/redis/RedisConnectionService';
import { spawn } from 'node:child_process';

export interface ProcessResult {
    code: number;
    stdout: string;
    stderr: string;
};

export class BinaryExecutorService {
    constructor(
        private readonly redisConnectionService: RedisConnectionService
    ) {
    }

    executeProcess(jobId: string, binaryPath: string, args: string[], cwd: string): Promise<ProcessResult> {
        return new Promise((resolve, reject) => {
            const child = spawn(binaryPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env }
            });
            this.redisConnectionService.registerActiveProcess(jobId, child);

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
            child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

            child.on('error', (error) => {
                this.redisConnectionService.unregisterActiveProcess(jobId);
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', (code) => {
                this.redisConnectionService.unregisterActiveProcess(jobId);
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: Buffer.concat(stderrChunks).toString('utf-8')
                });
            });
        });
    }
};
