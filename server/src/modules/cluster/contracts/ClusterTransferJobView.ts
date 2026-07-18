import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import type {
    ClusterTransferJobCursor,
    ClusterTransferJobReason,
    ClusterTransferJobState,
    ClusterTransferJobStats
} from '@modules/cluster/utilities/cluster-transfer-job';

/**
 * Read projection of a {@link ClusterTransferJob} aggregate.
 *
 * Surfaced through domain ports (e.g. it is embedded in {@link TeamClusterDTO}
 * as `activeTransfers`) so it is domain vocabulary. The `toClusterTransferJobDTO`
 * mapper that builds it from the aggregate stays in the application layer.
 */
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
