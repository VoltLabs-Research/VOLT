/**
 * Pure, neutral STANDALONE copy of the storage bucket/prefix targets that must
 * be cleaned up when a trajectory is deleted. Mirrors the logic owned by
 * `@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes`
 * (`getTrajectoryStorageCleanupTargets`) exactly.
 *
 * Why a copy (not a re-export from the owner): the trajectory module source is
 * off-limits to this migration, so cross-module consumers depend on this neutral
 * standalone version instead of importing the trajectory module. Keep this file
 * in sync with the owner if the owner's bucket/prefix layout changes.
 *
 * Pure function over a plain string input + `@core/config` bucket names — no
 * `@modules/*` imports.
 */
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

export interface TrajectoryStorageCleanupTarget {
    bucket: string;
    prefix: string;
}

export const getTrajectoryStorageCleanupTargets = (trajectoryId: string): TrajectoryStorageCleanupTarget[] => {
    const trajectoryPrefix = `trajectory-${trajectoryId}/`;

    return [
        {
            bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.MODELS,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.RASTERIZER,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_BUCKETS.PLUGINS,
            prefix: `plugins/trajectory-${trajectoryId}/`
        }
    ];
};
