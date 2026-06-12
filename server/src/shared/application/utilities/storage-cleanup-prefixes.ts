/**
 * Pure, neutral helper for resolving the storage bucket/prefix targets that must
 * be cleaned up when an analysis is deleted. Canonical home in the neutral
 * `shared` layer (detachable-modules migration) so cluster/analysis needn't be
 * cross-coupled for cleanup target resolution.
 *
 * Pure function over plain string inputs + `@core/config` bucket names — no
 * `@modules/*` imports. The original
 * `@modules/analysis/utilities/storage-cleanup-prefixes` re-exports these for
 * backward compatibility.
 */
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
