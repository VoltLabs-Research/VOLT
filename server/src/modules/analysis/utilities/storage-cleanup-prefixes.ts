import { SYS_BUCKETS } from '@core/config/minio';

export interface AnalysisStorageCleanupTarget {
    bucket: string;
    prefix: string;
}

export const getAnalysisStorageCleanupTargets = (
    trajectoryId: string,
    analysisId: string
): AnalysisStorageCleanupTarget[] => {
    const analysisPrefix = `trajectory-${trajectoryId}/analysis-${analysisId}/`;

    return [
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`
        },
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: analysisPrefix
        },
        {
            bucket: SYS_BUCKETS.MODELS,
            prefix: analysisPrefix
        },
        {
            bucket: SYS_BUCKETS.RASTERIZER,
            prefix: analysisPrefix
        },
        {
            bucket: SYS_BUCKETS.ANALYSIS_LOGS,
            prefix: analysisPrefix
        }
    ];
};
