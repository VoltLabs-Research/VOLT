import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type {
    ProcessExecutionLogSink,
    ProcessExecutionLogStream
} from '@/core/runtime/contracts/execution-log';
import { registerProcess, unregisterProcess } from '@/core/runtime/infrastructure/process-tracker';
import { spawn } from 'node:child_process';

export interface ProcessExecutionResult {
    code: number;
    stdout: string;
    stderr: string;
}

export interface ProcessExecutionInput {
    jobId: string;
    commandPath: string;
    args: string[];
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    logSink?: ProcessExecutionLogSink;
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_KILL_GRACE_PERIOD_MS = 5_000;

@Service('binaryExecutorService')
export class BinaryExecutorService {
    async executeProcess({
        jobId,
        commandPath,
        args,
        cwd,
        env,
        timeoutMs = DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS,
        logSink
    }: ProcessExecutionInput): Promise<ProcessExecutionResult> {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const enforceTimeout = timeoutMs > 0;
            const child = spawn(commandPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, ...env }
            });
            registerProcess(jobId, child);

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let timedOut = false;
            let forceKillTimeout: NodeJS.Timeout | undefined;

            const executionTimeout = enforceTimeout
                ? setTimeout(() => {
                    timedOut = true;
                    logger.warn('Plugin process exceeded execution timeout');
                    child.kill('SIGTERM');

                    forceKillTimeout = setTimeout(() => {
                        child.kill('SIGKILL');
                    }, PROCESS_KILL_GRACE_PERIOD_MS);
                    forceKillTimeout.unref?.();
                    this.forwardChunk(logSink, 'system', `Process timed out after ${timeoutMs}ms\n`);
                }, timeoutMs)
                : undefined;
            executionTimeout?.unref?.();

            const cleanupProcess = (): void => {
                clearTimeout(executionTimeout);
                if (forceKillTimeout) {
                    clearTimeout(forceKillTimeout);
                }
                unregisterProcess(jobId, child);
            };

            child.stdout.on('data', (chunk: Buffer) => {
                stdoutBytes = this.appendOutputChunk(stdoutChunks, stdoutBytes, chunk);
                this.forwardChunk(logSink, 'stdout', chunk.toString('utf-8'));
            });

            child.stderr.on('data', (chunk: Buffer) => {
                stderrBytes = this.appendOutputChunk(stderrChunks, stderrBytes, chunk);
                this.forwardChunk(logSink, 'stderr', chunk.toString('utf-8'));
            });

            child.on('error', async (error) => {
                cleanupProcess();
                logger.error(
                    {
                        jobId,
                        pid: child.pid,
                        elapsedMs: Date.now() - startedAt,
                        err: error
                    },
                    'Plugin process failed to spawn or crashed'
                );
                await this.flushLogSink(logSink);
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', async (code) => {
                cleanupProcess();
                await this.flushLogSink(logSink);
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: `${Buffer.concat(stderrChunks).toString('utf-8')}${timedOut ? `\nProcess timed out after ${timeoutMs}ms` : ''}`
                });
            });
        });
    }

    private appendOutputChunk(chunks: Buffer[], bufferedBytes: number, chunk: Buffer): number {
        if (bufferedBytes >= MAX_OUTPUT_BYTES) {
            return bufferedBytes;
        }

        chunks.push(chunk);
        return bufferedBytes + chunk.length;
    }

    private forwardChunk(
        logSink: ProcessExecutionLogSink | undefined,
        stream: ProcessExecutionLogStream,
        chunkText: string
    ): void {
        if (!logSink || chunkText.length === 0) {
            return;
        }

        Promise.resolve(logSink.handleChunk({
            stream,
            text: chunkText,
            occurredAt: new Date().toISOString()
        })).catch(() => {
            logger.warn('Failed to forward process log chunk');
        });
    }

    private async flushLogSink(logSink: ProcessExecutionLogSink | undefined): Promise<void> {
        if (!logSink?.flush) {
            return;
        }

        try {
            await logSink.flush();
        } catch {
            logger.warn('Failed to flush process log sink');
        }
    }
}
