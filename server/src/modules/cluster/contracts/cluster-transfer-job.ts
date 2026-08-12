import type ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import type {
    ClusterTransferJobCursor,
    ClusterTransferJobReason as ClusterTransferJobReasonContract,
    ClusterTransferJobState as ClusterTransferJobStateContract,
    ClusterTransferJobStats
} from '@volt/contracts/modules/cluster/domain';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';

export enum ClusterTransferJobState {
    Queued = 'queued',
    Freezing = 'freezing',
    Copying = 'copying',
    Verifying = 'verifying',
    Switching = 'switching',
    Cleaning = 'cleaning',
    Completed = 'completed',
    Failed = 'failed',
    Cancelled = 'cancelled'
}

export enum ClusterTransferJobReason {
    Manual = 'manual',
    SoftLimit = 'soft-limit',
    HardLimit = 'hard-limit'
}

export interface ClusterTransferJobProps {
    team: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    buckets: StoragePlacementBucketRef[];
    state: ClusterTransferJobStateContract;
    reason: ClusterTransferJobReasonContract;
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

export interface ClusterTransferJob {
    readonly _id: string;
    readonly id: string;
    props: ClusterTransferJobProps;
}

export const createClusterTransferJobDefaults = (): Partial<ClusterTransferJobProps> => ({
    state: ClusterTransferJobState.Queued,
    reason: ClusterTransferJobReason.Manual,
    cleanupSource: true,
    cursor: {
        bucketIndex: 0,
        lastObjectKey: null
    },
    stats: {
        copiedObjects: 0,
        copiedBytes: 0,
        verifiedObjects: 0,
        verifiedBytes: 0,
        deletedObjects: 0
    },
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null
});

export const toClusterTransferJobLike = (entity: ClusterTransferJobEntity): ClusterTransferJob => ({
    _id: entity.id,
    id: entity.id,
    props: {
        team: entity.team,
        scopeType: entity.scopeType,
        scopeId: entity.scopeId,
        sourceClusterId: entity.sourceClusterId,
        destinationClusterId: entity.destinationClusterId,
        buckets: entity.buckets,
        state: entity.state,
        reason: entity.reason,
        cleanupSource: entity.cleanupSource,
        requestedBy: entity.requestedBy,
        cursor: entity.cursor,
        stats: entity.stats,
        errorCode: entity.errorCode,
        errorMessage: entity.errorMessage,
        startedAt: entity.startedAt,
        finishedAt: entity.finishedAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
    }
});


export const describeClusterTransferJob = (job: ClusterTransferJob): string => {
    return `transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId} sourceClusterId=${job.props.sourceClusterId}`;
};
