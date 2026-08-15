import { singleton } from '@shared/application/utilities/singleton';
import { logger } from '@shared/infrastructure/logger';
import { createHash } from 'node:crypto';
import { getAvailableCpuCount, resolvePluginProcessEstMemoryMb, resolvePluginProcessMemoryBudgetMb, computePluginProcessMemorySlots, resolvePluginProcessConcurrency } from '@shared/domain/utilities/runtime-capacity';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import {
    PluginProcessChannel,
    type PooledProcessSpawnInput
} from '@modules/plugin/services/runtime/PluginProcessChannel';
import { PluginProcessMemoryGuard } from '@modules/plugin/services/runtime/plugin-process-memory-guard';


const DEFAULT_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const SPAWN_IDLE_POOL_ACQUIRE_TIMEOUT_MS = 60_000;
const SPAWN_SLOT_REPOLL_INTERVAL_MS = 1_000;

interface PluginProcessGroup {
    poolKey: string;
    pluginId: string;
    idle: PluginProcessChannel[];
    active: Set<PluginProcessChannel>;
    waiters: Array<() => void>;
    retired: boolean;
}

export class PluginProcessPool {
    private readonly groups = new Map<string, PluginProcessGroup>();
    private readonly minIdle: number;
    private readonly requestTimeoutMs: number;
    private readonly memoryGuard: PluginProcessMemoryGuard;
    private readonly effectiveMaxConcurrent: number;
    private shuttingDown = false;

    constructor() {
        const cpuMaxConcurrent = readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MAX') ?? Math.max(1, getAvailableCpuCount() - 1);
        const estimatedProcessMemoryMb = resolvePluginProcessEstMemoryMb();
        const pluginProcessMemoryBudgetMb = resolvePluginProcessMemoryBudgetMb();
        const memorySlots = computePluginProcessMemorySlots(pluginProcessMemoryBudgetMb, estimatedProcessMemoryMb);

        this.effectiveMaxConcurrent = resolvePluginProcessConcurrency();
        this.memoryGuard = new PluginProcessMemoryGuard(estimatedProcessMemoryMb);
        this.minIdle = readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MIN_IDLE') ?? 1;
        this.requestTimeoutMs = readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_REQUEST_TIMEOUT_MS') ?? DEFAULT_REQUEST_TIMEOUT_MS;

        logger.info(
            {
                cpuMaxConcurrent,
                pluginProcessMemoryBudgetMb,
                estimatedProcessMemoryMb,
                memorySlots,
                effectiveMaxConcurrent: this.effectiveMaxConcurrent
            },
            '@plugin-process-pool: resolved process pool concurrency budget'
        );
    }

    async acquire(input: PooledProcessSpawnInput): Promise<PluginProcessChannel> {
        if (this.shuttingDown) {
            throw new Error('PluginProcessPool is shutting down');
        }

        const poolKey = this.buildPoolKey(input);
        this.retireSupersededIdleGroups(input.pluginId, poolKey);
        const group = this.resolveGroup(poolKey, input.pluginId);
        const waitStartAt = Date.now();

        while (true) {
            if (this.shuttingDown) {
                throw new Error('PluginProcessPool is shutting down');
            }

            const idleChannel = this.popIdle(group);
            if (idleChannel) {
                return idleChannel;
            }

            if (this.countActiveProcesses() < this.effectiveMaxConcurrent
                && await this.memoryGuard.hasHeadroomForSpawn()) {
                return this.spawnAndTrack(input, group);
            }

            if (Date.now() - waitStartAt > SPAWN_IDLE_POOL_ACQUIRE_TIMEOUT_MS) {
                throw new Error(
                    `Timed out waiting for plugin process slot (pluginId=${input.pluginId}, active=${this.countActiveProcesses()})`
                );
            }

            await this.waitForSlot(group);
        }
    }

    release(channel: PluginProcessChannel): void {
        const group = this.groups.get(channel.poolKey);
        if (!group) return;

        if (this.shuttingDown || channel.isClosed || group.retired
            || (group.idle.length >= this.minIdle && group.active.size > this.minIdle)) {
            group.active.delete(channel);
            void channel.destroy();
            this.deleteGroupIfDrained(group);
            this.notifyWaiters(group, true);
            return;
        }

        group.idle.push(channel);
        this.notifyWaiters(group, false);
    }

    async shutdown(): Promise<void> {
        this.shuttingDown = true;
        const closures: Promise<void>[] = [];
        for (const group of this.groups.values()) {
            for (const channel of [...group.idle, ...group.active]) {
                closures.push(channel.destroy());
            }
            group.idle.length = 0;
            group.active.clear();
            group.waiters.splice(0).forEach((resolve) => resolve());
        }
        await Promise.allSettled(closures);
        this.groups.clear();
    }

    private resolveGroup(poolKey: string, pluginId: string): PluginProcessGroup {
        const existing = this.groups.get(poolKey);
        if (existing) {
            return existing;
        }

        const group: PluginProcessGroup = {
            poolKey,
            pluginId,
            idle: [],
            active: new Set<PluginProcessChannel>(),
            waiters: [],
            retired: false
        };
        this.groups.set(poolKey, group);
        return group;
    }

    private popIdle(group: PluginProcessGroup): PluginProcessChannel | null {
        while (group.idle.length > 0) {
            const candidate = group.idle.shift();
            if (!candidate) break;
            if (!candidate.isClosed) {
                group.active.add(candidate);
                return candidate;
            }
        }
        return null;
    }

    private countActiveProcesses(): number {
        let count = 0;
        for (const group of this.groups.values()) {
            count += group.active.size;
        }
        return count;
    }

    private async spawnAndTrack(
        input: PooledProcessSpawnInput,
        group: PluginProcessGroup
    ): Promise<PluginProcessChannel> {
        const channel = new PluginProcessChannel(input, group.poolKey, this.requestTimeoutMs);
        channel.onceTerminated(() => {
            this.forgetChannel(group, channel);
        });

        try {
            await channel.waitUntilReady();
        } catch (error: unknown) {
            await channel.destroy();
            throw error;
        }

        group.active.add(channel);
        return channel;
    }

    private forgetChannel(group: PluginProcessGroup, channel: PluginProcessChannel): void {
        group.active.delete(channel);
        const idleIndex = group.idle.indexOf(channel);
        if (idleIndex >= 0) {
            group.idle.splice(idleIndex, 1);
        }
        this.deleteGroupIfDrained(group);
        this.notifyWaiters(group, true);
    }

    private wakeOneWaiter(group: PluginProcessGroup): boolean {
        const waiter = group.waiters.shift();
        if (!waiter) {
            return false;
        }
        waiter();
        return true;
    }

    private notifyWaiters(releasedGroup: PluginProcessGroup, freedGlobalSlot: boolean): void {
        if (this.wakeOneWaiter(releasedGroup)) {
            return;
        }
        if (!freedGlobalSlot) {
            return;
        }
        for (const group of this.groups.values()) {
            if (this.wakeOneWaiter(group)) {
                return;
            }
        }
    }

    private waitForSlot(group: PluginProcessGroup): Promise<void> {
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
            const timer = setTimeout(settle, SPAWN_SLOT_REPOLL_INTERVAL_MS);
            timer.unref();
            group.waiters.push(settle);
        });
    }

    private buildPoolKey(input: PooledProcessSpawnInput): string {
        const digest = createHash('sha256')
            .update([input.pluginId, input.commandPath, input.stubPath, input.pluginRoot, input.entrypointScript].join('\0'))
            .digest('hex');

        return `${input.pluginId}:${digest}`;
    }

    private retireSupersededIdleGroups(pluginId: string, activePoolKey: string): void {
        for (const [poolKey, group] of this.groups.entries()) {
            if (poolKey === activePoolKey || group.pluginId !== pluginId) {
                continue;
            }

            group.retired = true;
            const idle = group.idle.splice(0);
            for (const channel of idle) {
                group.active.delete(channel);
                void channel.destroy();
            }
            group.waiters.splice(0).forEach((resolve) => resolve());
            this.deleteGroupIfDrained(group);
        }
    }

    private deleteGroupIfDrained(group: PluginProcessGroup): void {
        if (group.active.size === 0 && group.idle.length === 0) {
            this.groups.delete(group.poolKey);
        }
    }
}

export const getPluginProcessPool = singleton((): PluginProcessPool => new PluginProcessPool());
