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
const DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_KILL_GRACE_PERIOD_MS = 5_000;

export class BinaryExecutorService {
    constructor(
        private readonly pluginProcessPool: PluginProcessPool,
        private readonly sharedMemoryBridge: SharedMemoryBridge
    ) {}

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
            const child = spawn(commandPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: buildPluginProcessEnv(env)
            });
            registerProcess(jobId, child);

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let timedOut = false;
            let forceKillTimeout: NodeJS.Timeout | undefined;

            const executionTimeout = timeoutMs > 0
                ? setTimeout(() => {
                    timedOut = true;
                    logger.warn('Plugin process exceeded execution timeout');
                    child.kill('SIGTERM');

                    forceKillTimeout = setTimeout(() => {
                        child.kill('SIGKILL');
                    }, PROCESS_KILL_GRACE_PERIOD_MS);
                    forceKillTimeout.unref();
                    forwardLogChunk(logSink, 'system', `Process timed out after ${timeoutMs}ms\n`);
                }, timeoutMs)
                : undefined;
            executionTimeout?.unref();

            const cleanupProcess = (): void => {
                clearTimeout(executionTimeout);
                if (forceKillTimeout) {
                    clearTimeout(forceKillTimeout);
                }
                unregisterProcess(jobId, child);
            };

            child.stdout.on('data', (chunk: Buffer) => {
                stdoutBytes = this.appendOutputChunk(stdoutChunks, stdoutBytes, chunk);
                forwardLogChunk(logSink, 'stdout', chunk.toString('utf-8'));
            });

            child.stderr.on('data', (chunk: Buffer) => {
                stderrBytes = this.appendOutputChunk(stderrChunks, stderrBytes, chunk);
                forwardLogChunk(logSink, 'stderr', chunk.toString('utf-8'));
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
                await flushLogSink(logSink);
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', async (code) => {
                cleanupProcess();
                await flushLogSink(logSink);
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: `${Buffer.concat(stderrChunks).toString('utf-8')}${timedOut ? `\nProcess timed out after ${timeoutMs}ms` : ''}`
                });
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
