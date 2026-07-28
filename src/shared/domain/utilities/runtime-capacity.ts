import os from 'node:os';

const BYTES_PER_MB = 1024 * 1024;

export const DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB = 1024;

export const PLUGIN_PROCESS_MEMORY_BUDGET_RATIO = 0.7;

export const readPositiveIntegerEnv = (name: string): number | undefined => {
    const rawValue = process.env[name];
    if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) {
        return undefined;
    }

    return Number.parseInt(rawValue, 10);
};

export const getAvailableCpuCount = (): number => {
    return os.availableParallelism();
};

export const getTotalSystemMemoryMb = (): number => {
    return Math.max(1, Math.floor(os.totalmem() / BYTES_PER_MB));
};

export const deriveDefaultPluginProcessMemoryBudgetMb = (totalSystemMemoryMb: number): number => {
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

export interface SystemMemorySample {
    available?: number;
    free?: number;
}

export const selectAvailableMemoryMb = (sample: SystemMemorySample): number => {
    const available = sample.available;
    if (typeof available === 'number' && Number.isFinite(available) && available > 0) {
        return available / BYTES_PER_MB;
    }

    const free = sample.free;
    if (typeof free === 'number' && Number.isFinite(free) && free > 0) {
        return free / BYTES_PER_MB;
    }

    return 0;
};
