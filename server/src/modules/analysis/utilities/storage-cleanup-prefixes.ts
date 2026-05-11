import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

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
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            prefix: analysisPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.MODELS,
            prefix: analysisPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.RASTERIZER,
            prefix: analysisPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.ANALYSIS_LOGS,
            prefix: analysisPrefix
        }
    ];
};
