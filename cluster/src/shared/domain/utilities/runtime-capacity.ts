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

/*
 * Threads to give ONE plugin process, given that several run at once.
 *
 * This used to return (cpus - 1) unconditionally, while PluginProcessPool
 * independently allowed (cpus - 1) concurrent processes. The two numbers were
 * derived from the same core count and then multiplied against each other, so a
 * 16-thread host was told to run 15 processes of 15 threads. Native plugins add a
 * second pool on top of that — geogram's parallel Delaunay runs on OpenMP, and
 * before the coretoolkit fix it took min(cpus, 16) regardless of --threads — which
 * brought the total to roughly 465 software threads on 16 hardware ones. Measured
 * consequence: PTM reached only 2.7x on 16 threads and a stall in the allocator
 * turned about one frame in twelve into a multi-minute straggler.
 *
 * Dividing the cores by the concurrency is the fix. It is also the right shape for
 * these workloads: about a third of a plugin run is strictly serial (measured on
 * both PTM and OpenDXA), so filling the machine with independent frames extracts
 * more total throughput than pushing one frame's intra-stage parallelism.
 */
export const resolvePluginNativeThreadBudget = (concurrentProcesses?: number): number => {
    const configured = readPositiveIntegerEnv('PLUGIN_PROCESS_NATIVE_THREAD_BUDGET');
    if (configured !== undefined) {
        return configured;
    }

    const usableCpus = Math.max(1, getAvailableCpuCount() - RESERVED_DAEMON_CPUS);
    const processes = Math.max(1, concurrentProcesses ?? resolvePluginProcessConcurrency());

    return Math.max(MIN_NATIVE_THREAD_BUDGET, Math.floor(usableCpus / processes));
};

/*
 * The process-level half of the same budget, exposed so the thread budget above and
 * PluginProcessPool cannot drift apart — they must be two views of one decision.
 */
export const resolvePluginProcessConcurrency = (): number => {
    const cpuMaxConcurrent =
        readPositiveIntegerEnv('PLUGIN_PROCESS_POOL_MAX') ?? Math.max(1, getAvailableCpuCount() - 1);
    const memorySlots = computePluginProcessMemorySlots(
        resolvePluginProcessMemoryBudgetMb(),
        resolvePluginProcessEstMemoryMb()
    );
    return computeEffectivePluginProcessConcurrency(cpuMaxConcurrent, memorySlots);
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
