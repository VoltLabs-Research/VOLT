import os from 'node:os';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const BYTES_PER_MB = 1024 * 1024;

const DEFAULT_PLUGIN_PROCESS_EST_MEMORY_MB = 1024;

const PLUGIN_PROCESS_MEMORY_BUDGET_RATIO = 0.7;

/** Bounds for the derived per-process native thread budget. See `resolvePluginNativeThreadBudget`. */
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

/**
 * Per-process budget for a plugin's own native thread pool.
 *
 * Native plugins that build on OneTBB size their arena from the machine topology
 * (hwloc), which ignores `OMP_NUM_THREADS`, `TBB_NUM_THREADS` and even the process
 * affinity mask: measured on a 16-CPU host, all three still yielded a 16-thread
 * arena. The only lever that works is the plugin's own `--threads` flag, so the
 * daemon supplies this budget to any plugin that declares a `threads` argument
 * (see `WorkflowArgumentsHandler`).
 *
 * The budget is deliberately generous — nearly the whole machine — because the
 * common case on a single-machine deployment is one heavy frame at a time, and
 * holding a large analysis to a fraction of the CPUs wastes most of the host. One
 * core is left for the daemon itself so it keeps renewing queue locks and draining
 * plugin stdio while a binary saturates the rest.
 *
 * Oversubscription when many frames run at once is bounded by the process pool, and
 * a plugin that wedges under load is caught by the stall watchdog in
 * `BinaryExecutorService` rather than by starving it of threads.
 */
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
