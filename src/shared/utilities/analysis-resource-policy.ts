import {
    getAvailableCpuCount,
    getEffectiveMemoryLimitMegabytes,
    readPositiveIntegerEnv
} from './runtime-capacity';

const RESERVED_CPU_COUNT = readPositiveIntegerEnv('ANALYSIS_RESERVED_CPUS') ?? 1;
const ESTIMATED_ANALYSIS_MEMORY_MB = readPositiveIntegerEnv('ANALYSIS_ESTIMATED_MEMORY_MB') ?? 2048;
const LOCAL_ANALYSIS_CONCURRENCY_CAP = readPositiveIntegerEnv('ANALYSIS_MAX_CONCURRENCY');
const LOCAL_BINARY_THREAD_CAP = readPositiveIntegerEnv('ANALYSIS_BINARY_MAX_THREADS');
const RESULT_PROCESSING_CONCURRENCY = readPositiveIntegerEnv('ANALYSIS_RESULT_PROCESSING_CONCURRENCY');

const getCpuBudget = (): number => {
    return Math.max(1, getAvailableCpuCount() - RESERVED_CPU_COUNT);
};

const getMemoryBoundAnalysisConcurrency = (): number => {
    const effectiveMemoryLimitMb = getEffectiveMemoryLimitMegabytes();
    const reservableMemoryMb = Math.max(
        ESTIMATED_ANALYSIS_MEMORY_MB,
        Math.floor(effectiveMemoryLimitMb * 0.8)
    );

    return Math.max(1, Math.floor(reservableMemoryMb / ESTIMATED_ANALYSIS_MEMORY_MB));
};

export const getSafeAnalysisWorkerConcurrency = (requestedConcurrency: number): number => {
    const sanitizedRequestedConcurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency >= 1
        ? Math.floor(requestedConcurrency)
        : 1;
    const cpuBoundConcurrency = Math.max(1, Math.floor(getCpuBudget() / 2));
    const autoBoundConcurrency = Math.min(cpuBoundConcurrency, getMemoryBoundAnalysisConcurrency());
    const hardCap = LOCAL_ANALYSIS_CONCURRENCY_CAP
        ? Math.max(1, LOCAL_ANALYSIS_CONCURRENCY_CAP)
        : autoBoundConcurrency;

    return Math.min(sanitizedRequestedConcurrency, hardCap);
};

export const getRecommendedBinaryThreads = (
    requestedThreads: number,
    activeBinaryExecutions: number
): number => {
    const sanitizedRequestedThreads = Number.isFinite(requestedThreads) && requestedThreads >= 1
        ? Math.floor(requestedThreads)
        : 1;
    const fairShareThreads = Math.max(
        1,
        Math.floor(getCpuBudget() / Math.max(1, activeBinaryExecutions))
    );
    const hardCap = LOCAL_BINARY_THREAD_CAP
        ? Math.max(1, LOCAL_BINARY_THREAD_CAP)
        : fairShareThreads;

    return Math.max(1, Math.min(sanitizedRequestedThreads, fairShareThreads, hardCap));
};

export const getRecommendedResultProcessingConcurrency = (): number => {
    if (RESULT_PROCESSING_CONCURRENCY) {
        return Math.max(1, RESULT_PROCESSING_CONCURRENCY);
    }

    const cpuBudget = getCpuBudget();
    const memoryLimitMb = getEffectiveMemoryLimitMegabytes();

    if (cpuBudget >= 12 && memoryLimitMb >= 16_384) {
        return 2;
    }

    return 1;
};
