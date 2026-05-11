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
