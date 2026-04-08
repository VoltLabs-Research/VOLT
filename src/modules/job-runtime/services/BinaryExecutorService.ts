import { logger } from '@/core/logger';
import { registerProcess, unregisterProcess } from './processTracker';
import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const PROCESS_HEARTBEAT_INTERVAL_MS = 30_000;
const DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_KILL_GRACE_PERIOD_MS = 5_000;

export type ProcessExecutionLogStream = 'stdout' | 'stderr' | 'system';

export interface ProcessExecutionLogChunk {
    stream: ProcessExecutionLogStream;
    text: string;
    occurredAt: string;
}

export interface ProcessExecutionLogSink {
    handleChunk(chunk: ProcessExecutionLogChunk): void | Promise<void>;
    flush?(): Promise<void>;
}

export interface ProcessResult {
    code: number;
    stdout: string;
    stderr: string;
};

export interface ProcessExecutionInput {
    jobId: string;
    commandPath: string;
    args: string[];
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    logSink?: ProcessExecutionLogSink;
};

export interface BinaryExecutorService {
    executeProcess(input: ProcessExecutionInput): Promise<ProcessResult>;
};

export const createBinaryExecutorService = (): BinaryExecutorService => ({
    executeProcess({ jobId, commandPath, args, cwd, env, timeoutMs, logSink }) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const resolvedTimeoutMs = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)
                ? timeoutMs
                : DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS;
            const enforceTimeout = resolvedTimeoutMs > 0;
            const child = spawn(commandPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, ...env }
            });
            registerProcess(jobId, child);

            logger.info(
                {
                    jobId,
                    pid: child.pid,
                    commandPath,
                    args,
                    cwd
                },
                'Spawned plugin process'
            );

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let timedOut = false;
            const emitChunkToLogSink = (stream: ProcessExecutionLogStream, chunkText: string): void => {
                if (!logSink || chunkText.length === 0) {
                    return;
                }

                Promise.resolve(logSink.handleChunk({
                    stream,
                    text: chunkText,
                    occurredAt: new Date().toISOString()
                })).catch((error: unknown) => {
                    logger.warn(
                        {
                            err: error,
                            jobId,
                            stream
                        },
                        'Failed to forward process log chunk'
                    );
                });
            };
            const flushLogSink = async (): Promise<void> => {
                if (!logSink?.flush) {
                    return;
                }

                try {
                    await logSink.flush();
                } catch (error: unknown) {
                    logger.warn(
                        {
                            err: error,
                            jobId
                        },
                        'Failed to flush process log sink'
                    );
                }
            };
            const heartbeat = setInterval(() => {
                logger.info(
                    {
                        jobId,
                        pid: child.pid,
                        elapsedMs: Date.now() - startedAt,
                        stdoutBytes,
                        stderrBytes
                    },
                    'Plugin process still running'
                );
            }, PROCESS_HEARTBEAT_INTERVAL_MS);
            if (heartbeat.unref) {
                heartbeat.unref();
            }
            let forceKillTimeout: NodeJS.Timeout | undefined;
            const executionTimeout = enforceTimeout
                ? setTimeout(() => {
                    timedOut = true;
                    logger.warn(
                        {
                            jobId,
                            pid: child.pid,
                            elapsedMs: Date.now() - startedAt,
                            timeoutMs: resolvedTimeoutMs
                        },
                        'Plugin process exceeded execution timeout'
                    );
                    child.kill('SIGTERM');

                    forceKillTimeout = setTimeout(() => {
                    child.kill('SIGKILL');
                    }, PROCESS_KILL_GRACE_PERIOD_MS);
                    if (forceKillTimeout.unref) {
                        forceKillTimeout.unref();
                    }
                    emitChunkToLogSink(
                        'system',
                        `Process timed out after ${resolvedTimeoutMs}ms\n`
                    );
                }, resolvedTimeoutMs)
                : undefined;
            if (executionTimeout?.unref) {
                executionTimeout.unref();
            }

            child.stdout.on('data', (chunk: Buffer) => {
                if (stdoutBytes < MAX_OUTPUT_BYTES) {
                    stdoutChunks.push(chunk);
                    stdoutBytes += chunk.length;
                }
                emitChunkToLogSink('stdout', chunk.toString('utf-8'));
            });
            child.stderr.on('data', (chunk: Buffer) => {
                if (stderrBytes < MAX_OUTPUT_BYTES) {
                    stderrChunks.push(chunk);
                    stderrBytes += chunk.length;
                }
                emitChunkToLogSink('stderr', chunk.toString('utf-8'));
            });

            child.on('error', (error) => {
                void (async () => {
                    clearInterval(heartbeat);
                    clearTimeout(executionTimeout);
                    if (forceKillTimeout) {
                        clearTimeout(forceKillTimeout);
                    }
                    unregisterProcess(jobId);
                    logger.error(
                        {
                            jobId,
                            pid: child.pid,
                            elapsedMs: Date.now() - startedAt,
                            err: error
                        },
                        'Plugin process failed to spawn or crashed'
                    );
                    await flushLogSink();
                    reject(new Error(`Failed to spawn process: ${error.message}`));
                })();
            });

            child.on('close', (code) => {
                void (async () => {
                    clearInterval(heartbeat);
                    clearTimeout(executionTimeout);
                    if (forceKillTimeout) {
                        clearTimeout(forceKillTimeout);
                    }
                    unregisterProcess(jobId);
                    logger.info(
                        {
                            jobId,
                            pid: child.pid,
                            elapsedMs: Date.now() - startedAt,
                            code: code ?? 1,
                            stdoutBytes,
                            stderrBytes
                        },
                        'Plugin process closed'
                    );
                    await flushLogSink();
                    resolve({
                        code: code ?? 1,
                        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                        stderr: `${Buffer.concat(stderrChunks).toString('utf-8')}${timedOut ? `\nProcess timed out after ${resolvedTimeoutMs}ms` : ''}`
                    });
                })();
            });
        });
    }
});
