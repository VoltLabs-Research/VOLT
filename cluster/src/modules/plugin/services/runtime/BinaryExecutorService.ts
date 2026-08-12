import { singleton } from '@shared/application/utilities/singleton';
import type {
    ProcessExecutionResult,
    ProcessExecutionInput,
    PersistentPluginInvocationInput,
    PersistentPluginInvocationResult
} from '@shared/contracts/types/plugin-execution';
import { logger } from '@shared/infrastructure/logger';
import {
    flushLogSink,
    forwardLogChunk
} from '@modules/plugin/services/runtime/process-log-sink';
import { registerProcess, unregisterProcess } from '@shared/infrastructure/runtime/process-tracker';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { PluginProcessPool, getPluginProcessPool } from '@modules/plugin/services/runtime/PluginProcessPool';
import type { PooledProcessSpawnInput } from '@modules/plugin/services/runtime/PluginProcessChannel';
import { buildPluginProcessEnv } from '@modules/plugin/services/runtime/plugin-process-env';
import { resolvePythonStubPath } from '@modules/plugin/services/runtime/python-stub-path';
import { SharedMemoryBridge, getSharedMemoryBridge } from '@modules/plugin/services/runtime/SharedMemoryBridge';
import type { SharedFramePublishInput } from '@shared/contracts/types/shared-frame';
import type {
    PluginFrameDescriptor,
    PluginProcessRequest
} from '@shared/contracts/types/plugin-batch';
import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS = readPositiveIntegerEnv('PLUGIN_PROCESS_EXECUTION_TIMEOUT_MS')
    ?? 60 * 60 * 1000;
const DEFAULT_PROCESS_STALL_TIMEOUT_MS = readPositiveIntegerEnv('PLUGIN_PROCESS_STALL_TIMEOUT_MS')
    ?? 8 * 60 * 1000;
const PROCESS_KILL_GRACE_PERIOD_MS = 5_000;
const PROCESS_ABANDON_GRACE_PERIOD_MS = 5_000;

const DEFAULT_MAX_PROCESS_ATTEMPTS = readPositiveIntegerEnv('PLUGIN_PROCESS_MAX_ATTEMPTS') ?? 3;

interface SingleRunOutcome extends ProcessExecutionResult {
    timedOut: boolean;
    wedgeReason: 'stalled' | 'absolute-timeout' | null;
}

export class BinaryExecutorService {
    constructor(
        private readonly pluginProcessPool: PluginProcessPool,
        private readonly sharedMemoryBridge: SharedMemoryBridge
    ) {}

    async executeProcess(input: ProcessExecutionInput): Promise<ProcessExecutionResult> {
        const timeoutMs = input.timeoutMs ?? DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS;
        const stallTimeoutMs = DEFAULT_PROCESS_STALL_TIMEOUT_MS;
        const maxAttempts = Math.max(1, DEFAULT_MAX_PROCESS_ATTEMPTS);
        let outcome: SingleRunOutcome | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            outcome = await this.runProcessOnce(input, timeoutMs, stallTimeoutMs);
            if (!outcome.timedOut) {
                return {
                    code: outcome.code,
                    stdout: outcome.stdout,
                    stderr: outcome.stderr
                };
            }

            if (attempt < maxAttempts) {
                logger.warn(
                    {
                        jobId: input.jobId,
                        attempt,
                        maxAttempts,
                        reason: outcome.wedgeReason
                    },
                    'Plugin process wedged; respawning for another attempt'
                );
                forwardLogChunk(
                    input.logSink,
                    'system',
                    `[Volt] Plugin ${outcome.wedgeReason === 'stalled'
                        ? `produced no output for ${stallTimeoutMs}ms`
                        : `exceeded ${timeoutMs}ms`}; retrying (attempt ${attempt + 1}/${maxAttempts})\n`
                );
            }
        }

        logger.error(
            {
                jobId: input.jobId,
                maxAttempts,
                timeoutMs
            },
            'Plugin process exhausted every attempt without finishing'
        );

        return {
            code: outcome?.code ?? 1,
            stdout: outcome?.stdout ?? '',
            stderr: `${outcome?.stderr ?? ''}\nGave up after ${maxAttempts} attempt(s) of ${timeoutMs}ms each`
        };
    }

    private async runProcessOnce(
        {
            jobId,
            commandPath,
            args,
            cwd,
            env,
            logSink
        }: ProcessExecutionInput,
        timeoutMs: number,
        stallTimeoutMs: number
    ): Promise<SingleRunOutcome> {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const child = spawn(commandPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: buildPluginProcessEnv(env),
                detached: true
            });
            registerProcess(jobId, child);

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let wedgeReason: SingleRunOutcome['wedgeReason'] = null;
            let settled = false;
            let stallTimeout: NodeJS.Timeout | undefined;
            let forceKillTimeout: NodeJS.Timeout | undefined;
            let abandonTimeout: NodeJS.Timeout | undefined;

            const signalTree = (signal: NodeJS.Signals): void => {
                try {
                    if (child.pid !== undefined) {
                        process.kill(-child.pid, signal);
                        return;
                    }
                } catch {
                }
                try {
                    child.kill(signal);
                } catch { }
            };

            const cleanupProcess = (): void => {
                clearTimeout(absoluteTimeout);
                if (stallTimeout) {
                    clearTimeout(stallTimeout);
                }
                if (forceKillTimeout) {
                    clearTimeout(forceKillTimeout);
                }
                if (abandonTimeout) {
                    clearTimeout(abandonTimeout);
                }
                unregisterProcess(jobId, child);
            };

            const settle = async (code: number | null): Promise<void> => {
                if (settled) return;
                settled = true;
                cleanupProcess();
                await flushLogSink(logSink);
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: `${Buffer.concat(stderrChunks).toString('utf-8')}${wedgeReason
                        ? `\nProcess ${wedgeReason === 'stalled'
                            ? `stalled: no output for ${stallTimeoutMs}ms`
                            : `timed out after ${timeoutMs}ms`}`
                        : ''}`,
                    timedOut: wedgeReason !== null,
                    wedgeReason
                });
            };

            const declareWedged = (reason: NonNullable<SingleRunOutcome['wedgeReason']>): void => {
                if (settled || wedgeReason) return;
                wedgeReason = reason;
                logger.warn(
                    {
                        jobId,
                        pid: child.pid,
                        reason,
                        elapsedMs: Date.now() - startedAt
                    },
                    'Plugin process made no progress; terminating it'
                );
                forwardLogChunk(
                    logSink,
                    'system',
                    reason === 'stalled'
                        ? `Process stalled: no output for ${stallTimeoutMs}ms\n`
                        : `Process timed out after ${timeoutMs}ms\n`
                );
                signalTree('SIGTERM');

                forceKillTimeout = setTimeout(() => {
                    signalTree('SIGKILL');
                    abandonTimeout = setTimeout(() => {
                        logger.error(
                            {
                                jobId,
                                pid: child.pid
                            },
                            'Plugin process survived SIGKILL or leaked its stdio; abandoning it'
                        );
                        void settle(null);
                    }, PROCESS_ABANDON_GRACE_PERIOD_MS);
                    abandonTimeout.unref();
                }, PROCESS_KILL_GRACE_PERIOD_MS);
                forceKillTimeout.unref();
            };

            const armStallTimer = (): void => {
                if (stallTimeoutMs <= 0 || settled || wedgeReason) return;
                if (stallTimeout) {
                    clearTimeout(stallTimeout);
                }
                stallTimeout = setTimeout(() => declareWedged('stalled'), stallTimeoutMs);
                stallTimeout.unref();
            };

            const absoluteTimeout = timeoutMs > 0
                ? setTimeout(() => declareWedged('absolute-timeout'), timeoutMs)
                : undefined;
            absoluteTimeout?.unref();
            armStallTimer();

            child.stdout.on('data', (chunk: Buffer) => {
                armStallTimer();
                stdoutBytes = this.appendOutputChunk(stdoutChunks, stdoutBytes, chunk);
                forwardLogChunk(logSink, 'stdout', chunk.toString('utf-8'));
            });

            child.stderr.on('data', (chunk: Buffer) => {
                armStallTimer();
                stderrBytes = this.appendOutputChunk(stderrChunks, stderrBytes, chunk);
                forwardLogChunk(logSink, 'stderr', chunk.toString('utf-8'));
            });

            child.on('error', async (error) => {
                if (settled) return;
                settled = true;
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
                await flushLogSink(logSink);
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', (code) => {
                void settle(code);
            });
        });
    }

    async invokePersistentPlugin(input: PersistentPluginInvocationInput): Promise<PersistentPluginInvocationResult> {
        const stubPath = resolvePythonStubPath();
        const spawnInput: PooledProcessSpawnInput = {
            pluginId: input.pluginId,
            commandPath: input.pythonCommandPath,
            stubPath,
            pluginRoot: input.pluginRoot,
            entrypointScript: input.entrypointScript,
            env: input.env
        };

        const channel = await this.pluginProcessPool.acquire(spawnInput);
        const releaseables: Array<() => Promise<void>> = [];

        try {
            const request = await this.buildProcessRequest(input, releaseables);
            const response = await channel.send(request, {
                timeoutMs: input.timeoutMs,
                logSink: input.logSink
            });
            return { response };
        } finally {
            this.pluginProcessPool.release(channel);
            for (const release of releaseables) {
                try {
                    await release();
                } catch (error: unknown) {
                    logger.warn({ err: error }, '@binary-executor-service: cleanup failed');
                }
            }
        }
    }

    private async buildProcessRequest(
        input: PersistentPluginInvocationInput,
        releaseables: Array<() => Promise<void>>
    ): Promise<PluginProcessRequest> {
        let frame = input.frame;
        if (input.shmFramePublish) {
            frame = await this.attachPublishedFrame(
                frame ?? {
                    timestep: 0,
                    natoms: 0
                },
                input.shmFramePublish,
                releaseables
            );
        }

        return {
            opcode: 'process',
            frame,
            config: input.config
        };
    }

    private async attachPublishedFrame(
        baseFrame: PluginFrameDescriptor,
        publish: SharedFramePublishInput,
        releaseables: Array<() => Promise<void>>
    ): Promise<PluginFrameDescriptor> {
        const handle = await this.sharedMemoryBridge.publishFrame(publish);
        releaseables.push(() => handle.release());

        return {
            ...baseFrame,
            columns: handle.bindings.map((binding) => ({
                ...binding,
                binding: {
                    ...binding.binding,
                    mmapPath: handle.path ?? undefined
                }
            }))
        };
    }

    private appendOutputChunk(chunks: Buffer[], bufferedBytes: number, chunk: Buffer): number {
        if (bufferedBytes >= MAX_OUTPUT_BYTES) {
            return bufferedBytes;
        }

        chunks.push(chunk);
        return bufferedBytes + chunk.length;
    }
}

export const getBinaryExecutorService = singleton((): BinaryExecutorService => new BinaryExecutorService(getPluginProcessPool(), getSharedMemoryBridge()));
