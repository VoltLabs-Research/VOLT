import { toError } from '@shared/application/utilities/error-message';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { logger } from '@shared/infrastructure/logger';
import type { ProcessExecutionLogSink } from '@shared/contracts/types/execution-log';
import type {
    PluginProcessRequest,
    PluginProcessResponse
} from '@shared/contracts/types/plugin-batch';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { buildPluginProcessEnv } from '@modules/plugin/services/runtime/plugin-process-env';
import {
    PluginProcessFrameReader,
    decodePluginProcessResponse,
    encodePluginProcessFrame
} from '@modules/plugin/services/runtime/plugin-process-framing';
import {
    flushLogSink,
    forwardLogChunk
} from '@modules/plugin/services/runtime/process-log-sink';


const PROCESS_READY_GRACE_PERIOD_MS = readPositiveIntegerEnv('PLUGIN_PROCESS_READY_GRACE_MS') ?? 120_000;
const MAX_STDERR_BYTES = 256 * 1024;
const KILL_GRACE_PERIOD_MS = 5_000;

export interface PooledProcessSpawnInput {
    pluginId: string;
    commandPath: string;
    stubPath: string;
    pluginRoot: string;
    entrypointScript: string;
    env?: NodeJS.ProcessEnv;
}

interface PendingRequest {
    resolve: (response: PluginProcessResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

export class PluginProcessChannel {
    public readonly pluginId: string;
    public readonly poolKey: string;

    private readonly child: ChildProcessWithoutNullStreams;
    private readonly reader = new PluginProcessFrameReader();
    private readonly pendingByOpId = new Map<number, PendingRequest>();
    private readonly lifecycle = new EventEmitter();
    private stderrBuffer = '';
    private stderrBytes = 0;
    private nextOpId = 1;
    private ready = false;
    private closed = false;
    private closeReason: string | null = null;
    private activeLogSink?: ProcessExecutionLogSink;

    public constructor(
        input: PooledProcessSpawnInput,
        poolKey: string,
        private readonly defaultRequestTimeoutMs: number
    ) {
        this.pluginId = input.pluginId;
        this.poolKey = poolKey;
        this.child = spawn(
            input.commandPath,
            [input.stubPath, '--plugin-root', input.pluginRoot, '--entrypoint', input.entrypointScript],
            {
                cwd: input.pluginRoot,
                env: buildPluginProcessEnv(input.env, { PYTHONUNBUFFERED: '1' }),
                stdio: ['pipe', 'pipe', 'pipe']
            }
        ) as ChildProcessWithoutNullStreams;

        this.child.stdout.on('data', (chunk: Buffer) => {
            this.reader.push(chunk, (opId, payload) => this.completeRequest(opId, payload));
        });

        this.child.stderr.on('data', (chunk: Buffer) => {
            forwardLogChunk(this.activeLogSink, 'stderr', chunk.toString('utf-8'), { pluginId: this.pluginId });
            if (this.stderrBytes < MAX_STDERR_BYTES) {
                this.stderrBuffer += chunk.toString('utf-8');
                this.stderrBytes += chunk.byteLength;
            }
        });

        this.child.on('error', (error) => {
            logger.warn({
                err: error,
                pluginId: this.pluginId
            }, '@plugin-process-pool: spawn error');
            this.handleTermination(`error:${error.message}`);
        });

        this.child.on('close', (code, signal) => {
            const reason = signal ? `signal:${signal}` : `exit:${code ?? 'null'}`;
            if (this.stderrBuffer) {
                logger.warn(
                    {
                        pluginId: this.pluginId,
                        reason,
                        stderr: this.stderrBuffer.slice(-2048)
                    },
                    '@plugin-process-pool: plugin process exited'
                );
            }
            this.handleTermination(reason);
        });

        this.child.stdin.on('error', (error) => {
            logger.warn({
                err: error,
                pluginId: this.pluginId
            }, '@plugin-process-pool: stdin error');
        });
    }

    public get isClosed(): boolean {
        return this.closed;
    }

    public onceTerminated(listener: () => void): void {
        this.lifecycle.once('closed', listener);
    }

    public async waitUntilReady(): Promise<void> {
        if (this.closed) {
            throw new Error(`Plugin process closed before becoming ready: ${this.closeReason ?? 'unknown'}`);
        }
        if (this.ready) {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Plugin process failed to become ready within grace period'));
            }, PROCESS_READY_GRACE_PERIOD_MS);
            timer.unref();

            const cleanup = (): void => {
                clearTimeout(timer);
                this.lifecycle.off('ready', onReady);
                this.lifecycle.off('closed', onClose);
            };
            const onReady = (): void => {
                cleanup();
                resolve();
            };
            const onClose = (): void => {
                cleanup();
                reject(new Error(`Plugin process closed before becoming ready: ${this.closeReason ?? 'unknown'}`));
            };

            this.lifecycle.once('ready', onReady);
            this.lifecycle.once('closed', onClose);

            try {
                this.sendHandshake();
            } catch (error: unknown) {
                cleanup();
                reject(toError(error));
            }
        });
    }

    public async send(
        request: PluginProcessRequest,
        options: { timeoutMs?: number; logSink?: ProcessExecutionLogSink } = {}
    ): Promise<PluginProcessResponse> {
        if (this.closed) {
            throw new Error(`Plugin process for ${this.pluginId} is closed: ${this.closeReason ?? 'unknown'}`);
        }

        const opId = this.takeOpId();
        const timeoutMs = options.timeoutMs ?? this.defaultRequestTimeoutMs;
        const frame = encodePluginProcessFrame(opId, request);

        return new Promise<PluginProcessResponse>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingByOpId.delete(opId);
                this.detachLogSink();
                reject(new Error(`Plugin request ${opId} timed out after ${timeoutMs}ms`));
                this.restart(`request-timeout:${opId}`);
            }, timeoutMs);
            timeout.unref();

            this.activeLogSink = options.logSink;
            this.pendingByOpId.set(opId, {
                resolve,
                reject,
                timeout
            });
            this.write(frame);
        });
    }

    public async destroy(): Promise<void> {
        if (this.closed) return;
        this.closed = true;

        try {
            this.child.stdin.end();
        } catch { }

        return new Promise<void>((resolve) => {
            if (this.child.exitCode !== null || this.child.killed) {
                resolve();
                return;
            }
            this.child.once('close', () => resolve());
            this.child.kill('SIGTERM');
            const timer = setTimeout(() => {
                this.child.kill('SIGKILL');
            }, KILL_GRACE_PERIOD_MS);
            timer.unref();
        });
    }

    private takeOpId(): number {
        const opId = this.nextOpId;
        this.nextOpId = (this.nextOpId + 1) >>> 0;
        return opId;
    }

    private write(frame: Buffer[]): void {
        for (const part of frame) {
            this.child.stdin.write(part);
        }
    }

    private sendHandshake(): void {
        const opId = this.takeOpId();
        const timeout = setTimeout(() => {
            this.pendingByOpId.delete(opId);
        }, PROCESS_READY_GRACE_PERIOD_MS);
        timeout.unref();

        this.pendingByOpId.set(opId, {
            resolve: () => {
                if (!this.ready) {
                    this.ready = true;
                    this.lifecycle.emit('ready');
                }
            },
            reject: () => {},
            timeout
        });
        this.write(encodePluginProcessFrame(opId, { opcode: 'ping' }));
    }

    private completeRequest(opId: number, payload: Buffer): void {
        const pending = this.pendingByOpId.get(opId);
        if (!pending) {
            return;
        }
        this.pendingByOpId.delete(opId);
        clearTimeout(pending.timeout);

        try {
            const response = decodePluginProcessResponse(payload);
            this.detachLogSink();
            pending.resolve(response);
        } catch (error: unknown) {
            this.detachLogSink();
            pending.reject(error instanceof Error ? error : new Error(`Failed to decode plugin response: ${String(error)}`));
        }
    }

    private handleTermination(reason: string): void {
        if (this.closed) return;
        this.closed = true;
        this.closeReason = reason;

        for (const pending of this.pendingByOpId.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(`Plugin process terminated (${reason})`));
        }
        this.pendingByOpId.clear();
        this.detachLogSink();
        this.lifecycle.emit('closed');
    }

    private restart(reason: string): void {
        if (this.closed) return;
        logger.warn({
            pluginId: this.pluginId,
            reason
        }, '@plugin-process-pool: restarting plugin process');
        try {
            this.child.kill('SIGTERM');
        } catch { }
    }

    private detachLogSink(): void {
        const logSink = this.activeLogSink;
        this.activeLogSink = undefined;
        void flushLogSink(logSink);
    }
}
