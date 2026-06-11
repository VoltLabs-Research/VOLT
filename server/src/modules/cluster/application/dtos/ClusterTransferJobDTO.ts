import ClusterTransferJob from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { ClusterTransferJobDTO } from '@modules/cluster/domain/contracts/ClusterTransferJobView';

export type { ClusterTransferJobDTO } from '@modules/cluster/domain/contracts/ClusterTransferJobView';

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
