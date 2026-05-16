import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type {
    ProcessExecutionLogSink,
    ProcessExecutionLogStream
} from '@/core/runtime/contracts/execution-log';
import { registerProcess, unregisterProcess } from '@/core/runtime/infrastructure/process-tracker';
import {
    buildPluginProcessEnv,
    PluginProcessPool,
    resolvePythonStubPath,
    type PooledProcessSpawnInput
} from '@/modules/plugin/application/runtime/PluginProcessPool';
import { SharedMemoryBridge, type SharedFramePublishInput } from '@/modules/plugin/application/runtime/SharedMemoryBridge';
import type {
    PluginFrameDescriptor,
    PluginProcessRequest,
    PluginProcessResponse
} from '@/modules/plugin/contracts/plugin-batch';
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

export interface PersistentPluginInvocationInput {
    pluginId: string;
    pythonCommandPath: string;
    pluginRoot: string;
    entrypointScript: string;
    env?: NodeJS.ProcessEnv;
    logSink?: ProcessExecutionLogSink;
    frame?: PluginFrameDescriptor;
    frames?: PluginFrameDescriptor[];
    shmFramePublish?: SharedFramePublishInput;
    shmFramePublishes?: SharedFramePublishInput[];
    config?: Record<string, unknown>;
    mode?: 'single' | 'batch';
    timeoutMs?: number;
}

export interface PersistentPluginInvocationResult {
    response: PluginProcessResponse;
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_PROCESS_EXECUTION_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_KILL_GRACE_PERIOD_MS = 5_000;

@Service('binaryExecutorService')
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
                    this.forwardChunk(logSink, 'system', `Process timed out after ${timeoutMs}ms\n`);
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

        const pooled = await this.pluginProcessPool.acquire(spawnInput);
        const releaseables: Array<() => Promise<void>> = [];

        try {
            const request = await this.buildProcessRequest(input, releaseables);
            const response = await pooled.send(request, {
                timeoutMs: input.timeoutMs,
                logSink: input.logSink
            });
            return { response };
        } finally {
            pooled.release();
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
        const mode = input.mode ?? (input.frames || input.shmFramePublishes ? 'batch' : 'single');

        if (mode === 'batch') {
            const frames: PluginFrameDescriptor[] = [];
            if (input.shmFramePublishes?.length) {
                for (let index = 0; index < input.shmFramePublishes.length; index += 1) {
                    const publish = input.shmFramePublishes[index]!;
                    const baseFrame = input.frames?.[index] ?? { timestep: index, natoms: 0 };
                    frames.push(await this.attachPublishedFrame(baseFrame, publish, releaseables));
                }
            } else if (input.frames?.length) {
                frames.push(...input.frames);
            }
            return {
                opcode: 'process_batch',
                frames,
                config: input.config
            };
        }

        let frame = input.frame;
        if (input.shmFramePublish) {
            frame = await this.attachPublishedFrame(
                frame ?? { timestep: 0, natoms: 0 },
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

        if (handle.mode === 'mmap') {
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

        const inline = handle.inlinePayload;
        if (!inline) {
            return baseFrame;
        }

        return {
            ...baseFrame,
            columns: inline.columns.map((column, index) => ({
                name: column.name,
                dtype: column.dtype,
                shape: column.shape,
                binding: {
                    kind: 'inline',
                    dtype: column.dtype,
                    length: column.bytes.byteLength,
                    offset: index,
                    bytes: column.bytes
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

    private forwardChunk(
        logSink: ProcessExecutionLogSink | undefined,
        stream: ProcessExecutionLogStream,
        chunkText: string
    ): void {
        if (!logSink || chunkText.length === 0) return;

        Promise.resolve(logSink.handleChunk({
            stream,
            text: chunkText,
            occurredAt: new Date().toISOString()
        })).catch(() => {
            logger.warn('Failed to forward process log chunk');
        });
    }

    private async flushLogSink(logSink: ProcessExecutionLogSink | undefined): Promise<void> {
        if (!logSink?.flush) return;

        try {
            await logSink.flush();
        } catch {
            logger.warn('Failed to flush process log sink');
        }
    }
}
