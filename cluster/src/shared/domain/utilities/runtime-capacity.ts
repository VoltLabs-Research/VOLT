import os from 'node:os';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const BYTES_PER_MB = 1024 * 1024;

const DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB = 1024;

const PLUGIN_PROCESS_MEMORY_BUDGET_RATIO = 0.7;

const RESERVED_DAEMON_CPUS = 1;
const MIN_NATIVE_THREAD_BUDGET = 2;

export const getAvailableCpuCount = (): number => {
    return os.availableParallelism();
};

const getTotalSystemMemoryMb = (): number => {
    return Math.max(1, Math.floor(os.totalmem() / BYTES_PER_MB));
};

const deriveDefaultPluginProcessMemoryBudgetMb = (totalSystemMemoryMb: number): number => {
    return Math.max(1, Math.floor(totalSystemMemoryMb * PLUGIN_PROCESS_MEMORY_BUDGET_RATIO));
};

export const resolvePluginProcessMemoryBudgetMb = (): number => {
    return (
        readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MAX_MEMORY_MB') ??
        deriveDefaultPluginProcessMemoryBudgetMb(getTotalSystemMemoryMb())
    );
};

export const resolvePluginProcessEstMemoryMb = (): number => {
    return readPositiveIntegerEnv('PLUGIN_PROCESS_EST_MEMORY_MB') ?? DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB;
};

export const computePluginProcessMemorySlots = (maxMemoryMb: number, estMemoryMb: number): number => {
    if (!(estMemoryMb > 0)) {
        return 1;
    }
    return Math.max(1, Math.floor(maxMemoryMb / estMemoryMb));
};

export const computeEffectivePluginProcessConcurrency = (
    cpuMaxConcurrent: number,
    memorySlots: number
): number => {
    return Math.max(1, Math.min(cpuMaxConcurrent, memorySlots));
};

export const resolvePluginNativeThreadBudget = (): number => {
    const configured = readPositiveIntegerEnv('PLUGIN_PROCESS_NATIVE_THREAD_BUDGET');
    if (configured !== undefined) {
        return configured;
    }

    return Math.max(MIN_NATIVE_THREAD_BUDGET, getAvailableCpuCount() - RESERVED_DAEMON_CPUS);
};

interface SystemMemorySample {
    available?: number;
    free?: number;
}

/*
 * `available` (MemAvailable) before `free`, because on Linux `free` is not the
 * memory a new workload can have: the kernel lends every idle page to the page
 * cache, so `free` collapses on any busy host while that cache stays reclaimable.
 * systeminformation's own `used` is `total - free`, which is why deriving from it
 * reports a nearly-full machine that is in fact nearly empty.
 *
 * `free` is only the fallback for platforms or si versions that leave `available`
 * unset — a pessimistic answer beats no answer for a spawn decision.
 */
export const selectAvailableMemoryBytes = (sample: SystemMemorySample): number => {
    const { available, free } = sample;
    if (available !== undefined && available > 0) {
        return available;
    }

    if (free !== undefined && free > 0) {
        return free;
    }

    return 0;
};

export const selectAvailableMemoryMb = (sample: SystemMemorySample): number => {
    return selectAvailableMemoryBytes(sample) / BYTES_PER_MB;
};
