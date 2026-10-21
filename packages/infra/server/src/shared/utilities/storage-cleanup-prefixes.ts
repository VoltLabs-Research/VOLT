import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';


interface AnalysisStorageCleanupTarget {
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
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Plugins,
            prefix: `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/`
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Plugins,
            prefix: analysisPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Models,
            prefix: analysisPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Rasterizer,
            prefix: analysisPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.AnalysisLogs,
            prefix: analysisPrefix
        }
    ];
};
