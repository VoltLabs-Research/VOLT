import ClusterTransferJob, {
    type ClusterTransferJobCursor,
    type ClusterTransferJobReason,
    type ClusterTransferJobState,
    type ClusterTransferJobStats
} from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import type { StoragePlacementBucketRef, StoragePlacementScopeType } from '@shared/infrastructure/contracts/team-cluster';

export interface ClusterTransferJobDTO {
    _id: string;
    team: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    buckets: StoragePlacementBucketRef[];
    state: ClusterTransferJobState;
    reason: ClusterTransferJobReason;
    cleanupSource: boolean;
    requestedBy: string;
    cursor: ClusterTransferJobCursor;
    stats: ClusterTransferJobStats;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export const toClusterTransferJobDTO = (
    clusterTransferJob: ClusterTransferJob
): ClusterTransferJobDTO => {
    return {
        _id: clusterTransferJob.id,
        team: clusterTransferJob.props.team,
        scopeType: clusterTransferJob.props.scopeType,
        scopeId: clusterTransferJob.props.scopeId,
        sourceClusterId: clusterTransferJob.props.sourceClusterId,
        destinationClusterId: clusterTransferJob.props.destinationClusterId,
        buckets: clusterTransferJob.props.buckets.map((bucketRef) => ({
            bucket: bucketRef.bucket,
            prefix: bucketRef.prefix
        })),
        state: clusterTransferJob.props.state,
        reason: clusterTransferJob.props.reason,
        cleanupSource: clusterTransferJob.props.cleanupSource,
        requestedBy: clusterTransferJob.props.requestedBy,
        cursor: {
            bucketIndex: clusterTransferJob.props.cursor.bucketIndex,
            lastObjectKey: clusterTransferJob.props.cursor.lastObjectKey
        },
        stats: {
            copiedObjects: clusterTransferJob.props.stats.copiedObjects,
            copiedBytes: clusterTransferJob.props.stats.copiedBytes,
            verifiedObjects: clusterTransferJob.props.stats.verifiedObjects,
            verifiedBytes: clusterTransferJob.props.stats.verifiedBytes,
            deletedObjects: clusterTransferJob.props.stats.deletedObjects
        },
        errorCode: clusterTransferJob.props.errorCode,
        errorMessage: clusterTransferJob.props.errorMessage,
        startedAt: clusterTransferJob.props.startedAt,
        finishedAt: clusterTransferJob.props.finishedAt,
        createdAt: clusterTransferJob.props.createdAt,
        updatedAt: clusterTransferJob.props.updatedAt
    };
};
