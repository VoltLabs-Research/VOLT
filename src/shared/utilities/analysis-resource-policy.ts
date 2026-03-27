import {
    getAvailableCpuCount,
    readPositiveIntegerEnv
} from './runtime-capacity';

const RESERVED_CPU_COUNT = readPositiveIntegerEnv('ANALYSIS_RESERVED_CPUS') ?? 0;
const LOCAL_ANALYSIS_CONCURRENCY_CAP = readPositiveIntegerEnv('ANALYSIS_MAX_CONCURRENCY');
const LOCAL_BINARY_THREAD_CAP = readPositiveIntegerEnv('ANALYSIS_BINARY_MAX_THREADS');
const RESULT_PROCESSING_CONCURRENCY = readPositiveIntegerEnv('ANALYSIS_RESULT_PROCESSING_CONCURRENCY');

const getCpuBudget = (): number => {
    return Math.max(1, getAvailableCpuCount() - RESERVED_CPU_COUNT);
};

export const getSafeAnalysisWorkerConcurrency = (requestedConcurrency: number): number => {
    const sanitizedRequestedConcurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency >= 1
        ? Math.floor(requestedConcurrency)
        : 1;
    const hardCap = LOCAL_ANALYSIS_CONCURRENCY_CAP
        ? Math.max(1, LOCAL_ANALYSIS_CONCURRENCY_CAP)
        : Number.POSITIVE_INFINITY;

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

    return getCpuBudget();
};
