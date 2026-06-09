import os from 'node:os';

const BYTES_PER_MB = 1024 * 1024;

/**
 * Default estimated resident memory footprint (in MB) for a single plugin
 * process. Used when PLUGIN_PROCESS_EST_MEMORY_MB is unset.
 */
export const DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB = 1024;

/**
 * Fraction of total system RAM granted to the plugin process pool when no
 * explicit PLUGIN_PROCESS_POOL_MAX_MEMORY_MB budget is configured.
 */
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

/**
 * Total physical system memory expressed in whole megabytes.
 */
export const getTotalSystemMemoryMb = (): number => {
    return Math.max(1, Math.floor(os.totalmem() / BYTES_PER_MB));
};

/**
 * Pure derivation of the default plugin-process memory budget (in MB) from the
 * total system memory. Never returns below 1.
 */
export const deriveDefaultPluginProcessMemoryBudgetMb = (totalSystemMemoryMb: number): number => {
    return Math.max(1, Math.floor(totalSystemMemoryMb * PLUGIN_PROCESS_MEMORY_BUDGET_RATIO));
};

/**
 * Resolves the total RAM budget (in MB) reserved for plugin processes.
 * Honors PLUGIN_PROCESS_POOL_MAX_MEMORY_MB; otherwise derives ~70% of total RAM.
 */
export const resolvePluginProcessMemoryBudgetMb = (): number => {
    return (
        readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MAX_MEMORY_MB') ??
        deriveDefaultPluginProcessMemoryBudgetMb(getTotalSystemMemoryMb())
    );
};

/**
 * Resolves the estimated RAM footprint (in MB) of a single plugin process.
 * Honors PLUGIN_PROCESS_EST_MEMORY_MB; otherwise falls back to the default.
 */
export const resolvePluginProcessEstMemoryMb = (): number => {
    return readPositiveIntegerEnv('PLUGIN_PROCESS_EST_MEMORY_MB') ?? DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB;
};

/**
 * Pure admission math: how many plugin processes fit within the memory budget.
 * Clamped to at least 1 and guarded against a non-positive per-process estimate.
 */
export const computePluginProcessMemorySlots = (maxMemoryMb: number, estMemoryMb: number): number => {
    if (!(estMemoryMb > 0)) {
        return 1;
    }
    return Math.max(1, Math.floor(maxMemoryMb / estMemoryMb));
};

/**
 * Pure admission math: the effective concurrency ceiling is the smaller of the
 * CPU-derived ceiling and the memory-derived slot count, never below 1.
 */
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

/**
 * Pure selection of currently usable system memory (in MB) from a sample,
 * preferring `available` (memory reclaimable without swapping) when present and
 * positive, otherwise falling back to `free`.
 */
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
