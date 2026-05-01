import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pack, unpack } from 'msgpackr';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import type {
    PluginProcessRequest,
    PluginProcessResponse
} from '@/modules/plugin/contracts/plugin-batch';
import { getAvailableCpuCount, readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';

const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const SPAWN_IDLE_POOL_ACQUIRE_TIMEOUT_MS = 60_000;
const PROCESS_READY_GRACE_PERIOD_MS = 30_000;
const MAX_STDERR_BYTES = 256 * 1024;

export interface PooledProcessSpawnInput {
    pluginId: string;
    commandPath: string;
    stubPath: string;
    pluginRoot: string;
    entrypointScript: string;
    env?: NodeJS.ProcessEnv;
}

export interface PooledProcessConfig {
    minIdle?: number;
    maxConcurrent?: number;
    requestTimeoutMs?: number;
}

export interface PooledRequestOptions {
    timeoutMs?: number;
}

interface PooledProcessInternals {
    child: ChildProcessWithoutNullStreams;
    poolKey: string;
    pluginId: string;
    stderrBytes: number;
    stderrBuffer: string;
    pendingByOpId: Map<number, PendingRequest>;
    headerBuffer: Buffer;
    headerCursor: number;
    payloadBuffer: Buffer | null;
    payloadCursor: number;
    payloadTargetLength: number;
    currentOpId: number;
    nextOpId: number;
    busy: boolean;
    ready: boolean;
    closed: boolean;
    closeReason: string | null;
    closeEmitter: EventEmitter;
}

interface PendingRequest {
    opId: number;
    resolve: (response: PluginProcessResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

export class PooledProcess {
    constructor(
        private readonly internals: PooledProcessInternals,
        private readonly pool: PluginProcessPool
    ) {}

    get pluginId(): string {
        return this.internals.pluginId;
    }

    get isAlive(): boolean {
        return !this.internals.closed;
    }

    async send(request: PluginProcessRequest, options: PooledRequestOptions = {}): Promise<PluginProcessResponse> {
        return this.pool.dispatchRequest(this.internals, request, options);
    }

    release(): void {
        this.pool.release(this.internals);
    }
}

@Service('pluginProcessPool')
export class PluginProcessPool {
    private readonly pools = new Map<string, PluginProcessInternalsGroup>();
    private readonly config: Required<PooledProcessConfig>;
    private shuttingDown = false;

    constructor() {
        this.config = {
            minIdle: readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MIN_IDLE') ?? 1,
            maxConcurrent: readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MAX') ?? Math.max(1, getAvailableCpuCount() - 1),
            requestTimeoutMs: readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_REQUEST_TIMEOUT_MS') ?? DEFAULT_REQUEST_TIMEOUT_MS
        };
    }

    async acquire(input: PooledProcessSpawnInput): Promise<PooledProcess> {
        if (this.shuttingDown) {
            throw new Error('PluginProcessPool is shutting down');
        }

        const poolKey = this.buildPoolKey(input);
        this.retireSupersededIdleGroups(input.pluginId, poolKey);
        const group = this.resolveGroup(poolKey, input);
        const idleInternals = this.popIdle(group);
        if (idleInternals) {
            idleInternals.busy = true;
            return new PooledProcess(idleInternals, this);
        }

        if (group.active.size < this.config.maxConcurrent) {
            const internals = this.spawnInternals(input, group);
            await this.waitForProcessReady(internals);
            internals.busy = true;
            group.active.add(internals);
            return new PooledProcess(internals, this);
        }

        const waitStartAt = Date.now();
        while (true) {
            if (this.shuttingDown) {
                throw new Error('PluginProcessPool is shutting down');
            }

            const reused = this.popIdle(group);
            if (reused) {
                reused.busy = true;
                return new PooledProcess(reused, this);
            }

            if (group.active.size < this.config.maxConcurrent) {
                const internals = this.spawnInternals(input, group);
                await this.waitForProcessReady(internals);
                internals.busy = true;
                group.active.add(internals);
                return new PooledProcess(internals, this);
            }

            const elapsed = Date.now() - waitStartAt;
            if (elapsed > SPAWN_IDLE_POOL_ACQUIRE_TIMEOUT_MS) {
                throw new Error(
                    `Timed out waiting for plugin process slot (pluginId=${input.pluginId}, active=${group.active.size})`
                );
            }

            await this.waitForSlot(group);
        }
    }

    release(internals: PooledProcessInternals): void {
        internals.busy = false;
        const group = this.pools.get(internals.poolKey);
        if (!group) return;

        group.waiters.splice(0).forEach((resolve) => resolve());

        if (this.shuttingDown || internals.closed || group.retired) {
            group.active.delete(internals);
            void this.destroyInternals(internals);
            this.deleteGroupIfDrained(group);
            return;
        }

        if (group.idle.length >= this.config.minIdle && group.active.size > this.config.minIdle) {
            group.active.delete(internals);
            void this.destroyInternals(internals);
            return;
        }

        group.idle.push(internals);
    }

    async dispatchRequest(
        internals: PooledProcessInternals,
        request: PluginProcessRequest,
        options: PooledRequestOptions
    ): Promise<PluginProcessResponse> {
        if (internals.closed) {
            throw new Error(`Plugin process for ${internals.pluginId} is closed: ${internals.closeReason ?? 'unknown'}`);
        }

        const opId = internals.nextOpId;
        internals.nextOpId = (internals.nextOpId + 1) >>> 0;
        const timeoutMs = options.timeoutMs ?? this.config.requestTimeoutMs;
        const payloadBuffer = pack(request);
        const header = Buffer.allocUnsafe(8);
        header.writeUInt32LE(opId, 0);
        header.writeUInt32LE(payloadBuffer.byteLength, 4);

        return new Promise<PluginProcessResponse>((resolve, reject) => {
            const timeout = setTimeout(() => {
                internals.pendingByOpId.delete(opId);
                reject(new Error(`Plugin request ${opId} timed out after ${timeoutMs}ms`));
                this.restartInternals(internals, `request-timeout:${opId}`);
            }, timeoutMs);
            timeout.unref?.();

            const pending: PendingRequest = { opId, resolve, reject, timeout };
            internals.pendingByOpId.set(opId, pending);

            const writeOk = internals.child.stdin.write(header) && internals.child.stdin.write(payloadBuffer);
            if (!writeOk) {
                internals.child.stdin.once('drain', () => {});
            }
        });
    }

    async shutdown(): Promise<void> {
        this.shuttingDown = true;
        const closures: Promise<void>[] = [];
        for (const group of this.pools.values()) {
            for (const internals of [...group.idle, ...group.active]) {
                closures.push(this.destroyInternals(internals));
            }
            group.idle.length = 0;
            group.active.clear();
            group.waiters.splice(0).forEach((resolve) => resolve());
        }
        await Promise.allSettled(closures);
        this.pools.clear();
    }

    private resolveGroup(poolKey: string, input: PooledProcessSpawnInput): PluginProcessInternalsGroup {
        const existing = this.pools.get(poolKey);
        if (existing) {
            existing.spawnInput = input;
            return existing;
        }

        const group: PluginProcessInternalsGroup = {
            poolKey,
            pluginId: input.pluginId,
            spawnInput: input,
            idle: [],
            active: new Set<PooledProcessInternals>(),
            waiters: [],
            retired: false
        };
        this.pools.set(poolKey, group);
        return group;
    }

    private popIdle(group: PluginProcessInternalsGroup): PooledProcessInternals | null {
        while (group.idle.length > 0) {
            const candidate = group.idle.shift()!;
            if (!candidate.closed) {
                group.active.add(candidate);
                return candidate;
            }
        }
        return null;
    }

    private spawnInternals(
        input: PooledProcessSpawnInput,
        group: PluginProcessInternalsGroup
    ): PooledProcessInternals {
        const args = [
            input.stubPath,
            '--plugin-root',
            input.pluginRoot,
            '--entrypoint',
            input.entrypointScript
        ];

        const child = spawn(input.commandPath, args, {
            cwd: input.pluginRoot,
            env: { ...process.env, ...input.env, PYTHONUNBUFFERED: '1' },
            stdio: ['pipe', 'pipe', 'pipe']
        }) as ChildProcessWithoutNullStreams;

        const internals: PooledProcessInternals = {
            child,
            poolKey: group.poolKey,
            pluginId: input.pluginId,
            stderrBytes: 0,
            stderrBuffer: '',
            pendingByOpId: new Map(),
            headerBuffer: Buffer.alloc(8),
            headerCursor: 0,
            payloadBuffer: null,
            payloadCursor: 0,
            payloadTargetLength: 0,
            currentOpId: 0,
            nextOpId: 1,
            busy: false,
            ready: false,
            closed: false,
            closeReason: null,
            closeEmitter: new EventEmitter()
        };

        child.stdout.on('data', (chunk: Buffer) => {
            this.onStdout(internals, chunk);
        });

        child.stderr.on('data', (chunk: Buffer) => {
            if (internals.stderrBytes < MAX_STDERR_BYTES) {
                const text = chunk.toString('utf-8');
                internals.stderrBuffer += text;
                internals.stderrBytes += chunk.byteLength;
            }
        });

        child.on('error', (error) => {
            logger.warn({ err: error, pluginId: input.pluginId }, '@plugin-process-pool: spawn error');
            this.handleTerminatedProcess(group, internals, `error:${error.message}`);
        });

        child.on('close', (code, signal) => {
            const reason = signal ? `signal:${signal}` : `exit:${code ?? 'null'}`;
            if (internals.stderrBuffer) {
                logger.warn(
                    { pluginId: input.pluginId, reason, stderr: internals.stderrBuffer.slice(-2048) },
                    '@plugin-process-pool: plugin process exited'
                );
            }
            this.handleTerminatedProcess(group, internals, reason);
        });

        child.stdin.on('error', (error) => {
            logger.warn({ err: error, pluginId: input.pluginId }, '@plugin-process-pool: stdin error');
        });

        return internals;
    }

    private async waitForProcessReady(internals: PooledProcessInternals): Promise<void> {
        if (internals.closed) {
            throw new Error(`Plugin process closed before becoming ready: ${internals.closeReason ?? 'unknown'}`);
        }
        if (internals.ready) {
            return;
        }

        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('Plugin process failed to become ready within grace period'));
            }, PROCESS_READY_GRACE_PERIOD_MS);
            timer.unref?.();

            const cleanup = (): void => {
                clearTimeout(timer);
                internals.closeEmitter.off('ready', onReady);
                internals.closeEmitter.off('closed', onClose);
            };
            const onReady = (): void => {
                cleanup();
                resolve();
            };
            const onClose = (): void => {
                cleanup();
                reject(new Error(`Plugin process closed before becoming ready: ${internals.closeReason ?? 'unknown'}`));
            };

            internals.closeEmitter.once('ready', onReady);
            internals.closeEmitter.once('closed', onClose);

            try {
                this.writeHandshake(internals);
            } catch (error: unknown) {
                cleanup();
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    private writeHandshake(internals: PooledProcessInternals): void {
        const request: PluginProcessRequest = { opcode: 'ping' };
        const payloadBuffer = pack(request);
        const opId = internals.nextOpId;
        internals.nextOpId = (internals.nextOpId + 1) >>> 0;
        const header = Buffer.allocUnsafe(8);
        header.writeUInt32LE(opId, 0);
        header.writeUInt32LE(payloadBuffer.byteLength, 4);

        const pending: PendingRequest = {
            opId,
            resolve: () => {
                if (!internals.ready) {
                    internals.ready = true;
                    internals.closeEmitter.emit('ready');
                }
            },
            reject: () => {},
            timeout: setTimeout(() => {
                internals.pendingByOpId.delete(opId);
            }, PROCESS_READY_GRACE_PERIOD_MS)
        };
        pending.timeout.unref?.();
        internals.pendingByOpId.set(opId, pending);

        internals.child.stdin.write(header);
        internals.child.stdin.write(payloadBuffer);
    }

    private onStdout(internals: PooledProcessInternals, chunk: Buffer): void {
        let cursor = 0;
        while (cursor < chunk.byteLength) {
            if (internals.payloadBuffer === null) {
                const required = 8 - internals.headerCursor;
                const copyLength = Math.min(required, chunk.byteLength - cursor);
                chunk.copy(internals.headerBuffer, internals.headerCursor, cursor, cursor + copyLength);
                internals.headerCursor += copyLength;
                cursor += copyLength;

                if (internals.headerCursor === 8) {
                    const opId = internals.headerBuffer.readUInt32LE(0);
                    const payloadLength = internals.headerBuffer.readUInt32LE(4);
                    internals.currentOpId = opId;
                    internals.payloadTargetLength = payloadLength;
                    internals.payloadBuffer = Buffer.allocUnsafe(payloadLength);
                    internals.payloadCursor = 0;
                    internals.headerCursor = 0;

                    if (payloadLength === 0) {
                        this.completeResponse(internals, opId, Buffer.alloc(0));
                        internals.payloadBuffer = null;
                    }
                }
            } else {
                const remaining = internals.payloadTargetLength - internals.payloadCursor;
                const copyLength = Math.min(remaining, chunk.byteLength - cursor);
                chunk.copy(internals.payloadBuffer, internals.payloadCursor, cursor, cursor + copyLength);
                internals.payloadCursor += copyLength;
                cursor += copyLength;

                if (internals.payloadCursor === internals.payloadTargetLength) {
                    const buffer = internals.payloadBuffer;
                    const opId = internals.currentOpId;
                    internals.payloadBuffer = null;
                    internals.payloadCursor = 0;
                    internals.payloadTargetLength = 0;
                    this.completeResponse(internals, opId, buffer);
                }
            }
        }
    }

    private completeResponse(internals: PooledProcessInternals, opId: number, payload: Buffer): void {
        const pending = internals.pendingByOpId.get(opId);
        if (!pending) {
            return;
        }
        internals.pendingByOpId.delete(opId);
        clearTimeout(pending.timeout);

        try {
            const decoded = payload.byteLength > 0
                ? (unpack(payload) as PluginProcessResponse)
                : ({ ok: true } as PluginProcessResponse);
            pending.resolve(decoded);
        } catch (error: unknown) {
            pending.reject(error instanceof Error ? error : new Error(`Failed to decode plugin response: ${String(error)}`));
        }
    }

    private handleTerminatedProcess(
        group: PluginProcessInternalsGroup,
        internals: PooledProcessInternals,
        reason: string
    ): void {
        if (internals.closed) return;
        internals.closed = true;
        internals.closeReason = reason;

        for (const pending of internals.pendingByOpId.values()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(`Plugin process terminated (${reason})`));
        }
        internals.pendingByOpId.clear();
        internals.closeEmitter.emit('closed');

        group.active.delete(internals);
        const idleIndex = group.idle.indexOf(internals);
        if (idleIndex >= 0) {
            group.idle.splice(idleIndex, 1);
        }
        this.deleteGroupIfDrained(group);

        for (const resolve of group.waiters.splice(0)) {
            resolve();
        }
    }

    private async destroyInternals(internals: PooledProcessInternals): Promise<void> {
        if (internals.closed) return;
        internals.closed = true;

        try {
            internals.child.stdin.end();
        } catch { /* ignore */ }

        return new Promise<void>((resolve) => {
            const onClose = (): void => {
                resolve();
            };
            if (internals.child.exitCode !== null || internals.child.killed) {
                resolve();
                return;
            }
            internals.child.once('close', onClose);
            internals.child.kill('SIGTERM');
            const timer = setTimeout(() => {
                internals.child.kill('SIGKILL');
            }, 5_000);
            timer.unref?.();
        });
    }

    private restartInternals(internals: PooledProcessInternals, reason: string): void {
        if (internals.closed) return;
        logger.warn({ pluginId: internals.pluginId, reason }, '@plugin-process-pool: restarting plugin process');
        try {
            internals.child.kill('SIGTERM');
        } catch { /* ignore */ }
    }

    private waitForSlot(group: PluginProcessInternalsGroup): Promise<void> {
        return new Promise<void>((resolve) => {
            group.waiters.push(resolve);
        });
    }

    private buildPoolKey(input: PooledProcessSpawnInput): string {
        const digest = createHash('sha256')
            .update(input.pluginId)
            .update('\0')
            .update(input.commandPath)
            .update('\0')
            .update(input.stubPath)
            .update('\0')
            .update(input.pluginRoot)
            .update('\0')
            .update(input.entrypointScript);

        return `${input.pluginId}:${digest.digest('hex')}`;
    }

    private retireSupersededIdleGroups(pluginId: string, activePoolKey: string): void {
        for (const [poolKey, group] of this.pools.entries()) {
            if (poolKey === activePoolKey || group.pluginId !== pluginId) {
                continue;
            }

            group.retired = true;
            const idle = group.idle.splice(0);
            for (const internals of idle) {
                group.active.delete(internals);
                void this.destroyInternals(internals);
            }
            group.waiters.splice(0).forEach((resolve) => resolve());
            this.deleteGroupIfDrained(group);
        }
    }

    private deleteGroupIfDrained(group: PluginProcessInternalsGroup): void {
        if (group.active.size === 0 && group.idle.length === 0) {
            this.pools.delete(group.poolKey);
        }
    }
}

interface PluginProcessInternalsGroup {
    poolKey: string;
    pluginId: string;
    spawnInput: PooledProcessSpawnInput;
    idle: PooledProcessInternals[];
    active: Set<PooledProcessInternals>;
    waiters: Array<() => void>;
    retired: boolean;
}

export const resolvePythonStubPath = (): string => {
    const candidates = [
        path.resolve(__dirname, '..', '..', 'infrastructure', 'python', 'volt_plugin_stub.py'),
        path.resolve(__dirname, '..', '..', '..', 'src', 'modules', 'plugin', 'infrastructure', 'python', 'volt_plugin_stub.py')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
};
