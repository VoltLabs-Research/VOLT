import os from 'node:os';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const BYTES_PER_MB = 1024 * 1024;

const DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB = 1024;

const PLUGIN_PROCESS_MEMORY_BUDGET_RATIO = 0.7;

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

export interface SystemMemorySample {
    available?: number;
    free?: number;
}

export const selectAvailableMemoryMb = (sample: SystemMemorySample): number => {
    const { available, free } = sample;
    if (available !== undefined && available > 0) {
        return available / BYTES_PER_MB;
    }

    if (free !== undefined && free > 0) {
        return free / BYTES_PER_MB;
    }

    return 0;
};
