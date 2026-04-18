import { getAvailableCpuCount, readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';

const RESULT_PROCESSING_CONCURRENCY = readPositiveIntegerEnv('ANALYSIS_RESULT_PROCESSING_CONCURRENCY');

export const getRecommendedResultProcessingConcurrency = (): number => {
    return RESULT_PROCESSING_CONCURRENCY ?? Math.max(1, getAvailableCpuCount());
};
