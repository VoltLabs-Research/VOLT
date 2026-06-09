import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pack, unpack } from 'msgpackr';
import si from 'systeminformation';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import type { ProcessExecutionLogSink } from '@/core/runtime/contracts/execution-log';
import type {
    PluginProcessRequest,
    PluginProcessResponse
} from '@/modules/plugin/contracts/plugin-batch';
import {
    getAvailableCpuCount,
    readPositiveIntegerEnv,
    resolvePluginProcessEstMemoryMb,
    resolvePluginProcessMemoryBudgetMb,
    computePluginProcessMemorySlots,
    computeEffectivePluginProcessConcurrency,
    selectAvailableMemoryMb
} from '@/support/policies/runtime-capacity';

const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const SPAWN_IDLE_POOL_ACQUIRE_TIMEOUT_MS = 60_000;
const MEM_SAMPLE_CACHE_TTL_MS = 1_000;
const SPAWN_SLOT_REPOLL_INTERVAL_MS = 1_000;
const PROCESS_READY_GRACE_PERIOD_MS = readPositiveIntegerEnv('PLUGIN_PROCESS_READY_GRACE_MS') ?? 120_000;
const MAX_STDERR_BYTES = 256 * 1024;
const DEFAULT_NATIVE_THREAD_COUNT = readPositiveIntegerEnv('PLUGIN_PROCESS_DEFAULT_NATIVE_THREADS') ?? 1;
const NATIVE_THREAD_ENV_KEYS = [
    'OMP_NUM_THREADS',
    'OPENBLAS_NUM_THREADS',
    'MKL_NUM_THREADS',
    'VECLIB_MAXIMUM_THREADS',
    'NUMEXPR_NUM_THREADS',
    'BLIS_NUM_THREADS'
];

export const buildPluginProcessEnv = (
    inputEnv?: NodeJS.ProcessEnv,
    extraEnv: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv => {
    const env = { ...process.env, ...inputEnv, ...extraEnv };
    const threadCount = String(DEFAULT_NATIVE_THREAD_COUNT);

    for (const key of NATIVE_THREAD_ENV_KEYS) {
        if (!env[key]) {
            env[key] = threadCount;
        }
    }

    return env;
};

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
    logSink?: ProcessExecutionLogSink;
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
    activeLogSink?: ProcessExecutionLogSink;
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
    private readonly estMemoryMb: number;
    private readonly maxMemoryMb: number;
    private readonly memorySlots: number;
    private readonly effectiveMaxConcurrent: number;
    private memSampleCache: { freeMb: number; capturedAt: number } | null = null;
    private memSampleInFlight: Promise<number> | null = null;
    private shuttingDown = false;

    constructor() {
        const cpuMaxConcurrent = readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MAX') ?? Math.max(1, getAvailableCpuCount() - 1);
        this.estMemoryMb = resolvePluginProcessEstMemoryMb();
        this.maxMemoryMb = resolvePluginProcessMemoryBudgetMb();
        this.memorySlots = computePluginProcessMemorySlots(this.maxMemoryMb, this.estMemoryMb);
        this.effectiveMaxConcurrent = computeEffectivePluginProcessConcurrency(cpuMaxConcurrent, this.memorySlots);

        this.config = {
            minIdle: readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MIN_IDLE') ?? 1,
            maxConcurrent: cpuMaxConcurrent,
            requestTimeoutMs: readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_REQUEST_TIMEOUT_MS') ?? DEFAULT_REQUEST_TIMEOUT_MS
        };

        logger.info(
            {
                cpuMaxConcurrent,
                pluginProcessMemoryBudgetMb: this.maxMemoryMb,
                estimatedProcessMemoryMb: this.estMemoryMb,
                memorySlots: this.memorySlots,
                effectiveMaxConcurrent: this.effectiveMaxConcurrent
            },
            '@plugin-process-pool: resolved process pool concurrency budget'
        );
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

        if (await this.canSpawnNewProcess()) {
            return this.spawnAndTrack(input, group);
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

            if (await this.canSpawnNewProcess()) {
                return this.spawnAndTrack(input, group);
            }

            const elapsed = Date.now() - waitStartAt;
            if (elapsed > SPAWN_IDLE_POOL_ACQUIRE_TIMEOUT_MS) {
                throw new Error(
                    `Timed out waiting for plugin process slot (pluginId=${input.pluginId}, active=${this.countActiveProcesses()})`
                );
            }

            await this.waitForSlot(group);
        }
    }

    release(internals: PooledProcessInternals): void {
        internals.busy = false;
        const group = this.pools.get(internals.poolKey);
        if (!group) return;

        this.notifyWaiters();

        if (this.shuttingDown || internals.closed || group.retired) {
            group.active.delete(internals);
            void this.destroyInternals(internals);
            this.deleteGroupIfDrained(group);
            this.notifyWaiters();
            return;
        }

        if (group.idle.length >= this.config.minIdle && group.active.size > this.config.minIdle) {
            group.active.delete(internals);
            void this.destroyInternals(internals);
            this.notifyWaiters();
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
                void this.flushProcessLogSink(internals.activeLogSink);
                internals.activeLogSink = undefined;
                reject(new Error(`Plugin request ${opId} timed out after ${timeoutMs}ms`));
                this.restartInternals(internals, `request-timeout:${opId}`);
            }, timeoutMs);
            timeout.unref();

            internals.activeLogSink = options.logSink;
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

    private countActiveProcesses(): number {
        let count = 0;
        for (const group of this.pools.values()) {
            count += group.active.size;
        }
        return count;
    }

    private canSpawnProcess(): boolean {
        return this.countActiveProcesses() < this.effectiveMaxConcurrent;
    }

    /**
     * Whether a brand-new process may be spawned right now. Combines the static
     * effective ceiling (min of CPU and memory slots) with a dynamic free-RAM
     * gate. Reusing an idle process must NOT go through this gate.
     */
    private async canSpawnNewProcess(): Promise<boolean> {
        if (!this.canSpawnProcess()) {
            return false;
        }
        return this.hasFreeMemoryToSpawn();
    }

    private async hasFreeMemoryToSpawn(): Promise<boolean> {
        try {
            const freeMemoryMb = await this.readFreeSystemMemoryMb();
            return freeMemoryMb >= this.estMemoryMb;
        } catch (error: unknown) {
            // Fail open: never let a transient sampling failure stall the pool.
            logger.warn({ err: error }, '@plugin-process-pool: failed to sample system memory; allowing spawn');
            return true;
        }
    }

    private async readFreeSystemMemoryMb(): Promise<number> {
        const cached = this.memSampleCache;
        if (cached && Date.now() - cached.capturedAt < MEM_SAMPLE_CACHE_TTL_MS) {
            return cached.freeMb;
        }
        if (this.memSampleInFlight) {
            return this.memSampleInFlight;
        }

        const inFlight = (async (): Promise<number> => {
            const sample = await si.mem();
            const freeMb = selectAvailableMemoryMb(sample);
            this.memSampleCache = { freeMb, capturedAt: Date.now() };
            return freeMb;
        })();
        this.memSampleInFlight = inFlight;
        try {
            return await inFlight;
        } finally {
            if (this.memSampleInFlight === inFlight) {
                this.memSampleInFlight = null;
            }
        }
    }

    private async spawnAndTrack(
        input: PooledProcessSpawnInput,
        group: PluginProcessInternalsGroup
    ): Promise<PooledProcess> {
        const internals = this.spawnInternals(input, group);
        await this.waitForProcessReady(internals);
        internals.busy = true;
        group.active.add(internals);
        return new PooledProcess(internals, this);
    }

    private notifyWaiters(): void {
        for (const group of this.pools.values()) {
            group.waiters.splice(0).forEach((resolve) => resolve());
        }
    }

    private buildProcessEnv(inputEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
        return buildPluginProcessEnv(inputEnv, { PYTHONUNBUFFERED: '1' });
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
            env: this.buildProcessEnv(input.env),
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
            closeEmitter: new EventEmitter(),
            activeLogSink: undefined
        };

        child.stdout.on('data', (chunk: Buffer) => {
            this.onStdout(internals, chunk);
        });

        child.stderr.on('data', (chunk: Buffer) => {
            this.forwardProcessStderr(internals, chunk);
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
            timer.unref();

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
        pending.timeout.unref();
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
            void this.flushProcessLogSink(internals.activeLogSink);
            internals.activeLogSink = undefined;
            pending.resolve(decoded);
        } catch (error: unknown) {
            void this.flushProcessLogSink(internals.activeLogSink);
            internals.activeLogSink = undefined;
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
        void this.flushProcessLogSink(internals.activeLogSink);
        internals.activeLogSink = undefined;
        internals.closeEmitter.emit('closed');

        group.active.delete(internals);
        const idleIndex = group.idle.indexOf(internals);
        if (idleIndex >= 0) {
            group.idle.splice(idleIndex, 1);
        }
        this.deleteGroupIfDrained(group);

        this.notifyWaiters();
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
            timer.unref();
        });
    }

    private restartInternals(internals: PooledProcessInternals, reason: string): void {
        if (internals.closed) return;
        logger.warn({ pluginId: internals.pluginId, reason }, '@plugin-process-pool: restarting plugin process');
        try {
            internals.child.kill('SIGTERM');
        } catch { /* ignore */ }
    }

    private forwardProcessStderr(internals: PooledProcessInternals, chunk: Buffer): void {
        const text = chunk.toString('utf-8');
        const logSink = internals.activeLogSink;
        if (!logSink || text.length === 0) {
            return;
        }

        Promise.resolve(logSink.handleChunk({
            stream: 'stderr',
            text,
            occurredAt: new Date().toISOString()
        })).catch((error: unknown) => {
            logger.warn({ err: error, pluginId: internals.pluginId }, '@plugin-process-pool: failed to forward stderr log chunk');
        });
    }

    private async flushProcessLogSink(logSink: ProcessExecutionLogSink | undefined): Promise<void> {
        if (!logSink?.flush) {
            return;
        }

        try {
            await logSink.flush();
        } catch (error: unknown) {
            logger.warn({ err: error }, '@plugin-process-pool: failed to flush process log sink');
        }
    }

    private waitForSlot(group: PluginProcessInternalsGroup): Promise<void> {
        return new Promise<void>((resolve) => {
            let settled = false;
            const settle = (): void => {
                if (settled) {
                    return;
                }
                settled = true;
                const index = group.waiters.indexOf(settle);
                if (index >= 0) {
                    group.waiters.splice(index, 1);
                }
                clearTimeout(timer);
                resolve();
            };
            // Wake either on an explicit slot notification or after a short
            // interval, so a memory-gated wait re-evaluates as RAM frees up.
            const timer = setTimeout(settle, SPAWN_SLOT_REPOLL_INTERVAL_MS);
            timer.unref();
            group.waiters.push(settle);
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
