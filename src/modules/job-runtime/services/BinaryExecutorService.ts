import { logger } from '@/core/logger';
import { registerProcess, unregisterProcess } from './processTracker';
import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const PROCESS_HEARTBEAT_INTERVAL_MS = 30_000;
const PROCESS_EXECUTION_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_KILL_GRACE_PERIOD_MS = 5_000;

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
};

export interface BinaryExecutorService {
    executeProcess(input: ProcessExecutionInput): Promise<ProcessResult>;
};

export const createBinaryExecutorService = (): BinaryExecutorService => ({
    executeProcess({ jobId, commandPath, args, cwd, env }) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
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
            const executionTimeout = setTimeout(() => {
                timedOut = true;
                logger.warn(
                    {
                        jobId,
                        pid: child.pid,
                        elapsedMs: Date.now() - startedAt,
                        timeoutMs: PROCESS_EXECUTION_TIMEOUT_MS
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
            }, PROCESS_EXECUTION_TIMEOUT_MS);
            if (executionTimeout.unref) {
                executionTimeout.unref();
            }

            child.stdout.on('data', (chunk: Buffer) => {
                if (stdoutBytes < MAX_OUTPUT_BYTES) {
                    stdoutChunks.push(chunk);
                    stdoutBytes += chunk.length;
                }
            });
            child.stderr.on('data', (chunk: Buffer) => {
                if (stderrBytes < MAX_OUTPUT_BYTES) {
                    stderrChunks.push(chunk);
                    stderrBytes += chunk.length;
                }
            });

            child.on('error', (error) => {
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
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', (code) => {
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
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: `${Buffer.concat(stderrChunks).toString('utf-8')}${timedOut ? `\nProcess timed out after ${PROCESS_EXECUTION_TIMEOUT_MS}ms` : ''}`
                });
            });
        });
    }
});
