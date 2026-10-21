import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';


export interface TrajectoryStorageCleanupTarget {
    bucket: string;
    prefix: string;
}

export const getTrajectoryStorageCleanupTargets = (trajectoryId: string): TrajectoryStorageCleanupTarget[] => {
    const trajectoryPrefix = `trajectory-${trajectoryId}/`;

    return [
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Dumps,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Models,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Rasterizer,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Plugins,
            prefix: trajectoryPrefix
        },
        {
            bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Plugins,
            prefix: `plugins/trajectory-${trajectoryId}/`
        }
    ];
};
