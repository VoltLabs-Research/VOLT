import { SYS_BUCKETS } from '@core/config/minio';
import { getAnalysisStorageCleanupTargets } from '@modules/analysis/utilities/storage-cleanup-prefixes';
import { getTrajectoryStorageCleanupTargets } from '@modules/trajectory/utilities/trajectory/storage-cleanup-prefixes';
import type { StoragePlacementBucketRef } from '@shared/infrastructure/contracts/team-cluster';

const dedupeBucketRefs = (bucketRefs: StoragePlacementBucketRef[]): StoragePlacementBucketRef[] => {
    const deduped = new Map<string, StoragePlacementBucketRef>();

    for (const bucketRef of bucketRefs) {
        const key = `${bucketRef.bucket}:${bucketRef.prefix}`;
        if (!deduped.has(key)) {
            deduped.set(key, bucketRef);
        }
    }

    return [...deduped.values()];
};

export const buildTrajectoryPlacementBuckets = (trajectoryId: string): StoragePlacementBucketRef[] => {
    return dedupeBucketRefs(getTrajectoryStorageCleanupTargets(trajectoryId));
};

export const buildAnalysisPlacementBuckets = (
    trajectoryId: string,
    analysisId: string
): StoragePlacementBucketRef[] => {
    return dedupeBucketRefs(getAnalysisStorageCleanupTargets(trajectoryId, analysisId));
};

export const buildPluginBinaryPlacementBuckets = (pluginId: string): StoragePlacementBucketRef[] => {
    return [{
        bucket: SYS_BUCKETS.PLUGINS,
        prefix: `plugin-binaries/${pluginId}/`
    }];
};
