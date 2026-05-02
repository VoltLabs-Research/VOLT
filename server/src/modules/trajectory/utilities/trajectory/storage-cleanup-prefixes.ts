import { SYS_BUCKETS } from '@core/config/minio';

export interface TrajectoryStorageCleanupTarget {
    bucket: string;
    prefix: string;
}

export const getTrajectoryStorageCleanupTargets = (trajectoryId: string): TrajectoryStorageCleanupTarget[] => {
    const trajectoryPrefix = `trajectory-${trajectoryId}/`;

    return [
        {
            bucket: SYS_BUCKETS.DUMPS,
            prefix: trajectoryPrefix
        },
        {
            bucket: SYS_BUCKETS.MODELS,
            prefix: trajectoryPrefix
        },
        {
            bucket: SYS_BUCKETS.RASTERIZER,
            prefix: trajectoryPrefix
        },
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: trajectoryPrefix
        },
        {
            bucket: SYS_BUCKETS.PLUGINS,
            prefix: `plugins/trajectory-${trajectoryId}/`
        }
    ];
};
