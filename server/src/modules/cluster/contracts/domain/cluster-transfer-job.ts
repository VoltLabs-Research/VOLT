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

const createDefaultClusterTransferJobCursor = (): ClusterTransferJobCursor => ({
    bucketIndex: 0,
    lastObjectKey: null
});

const createDefaultClusterTransferJobStats = (): ClusterTransferJobStats => ({
    copiedObjects: 0,
    copiedBytes: 0,
    verifiedObjects: 0,
    verifiedBytes: 0,
    deletedObjects: 0
});

export const createClusterTransferJobProps = (
    input: {
        team: string;
        scopeType: StoragePlacementScopeType;
        scopeId: string;
        sourceClusterId: string;
        destinationClusterId: string;
        buckets: StoragePlacementBucketRef[];
        state?: ClusterTransferJobStateContract;
        reason?: ClusterTransferJobReasonContract;
        cleanupSource?: boolean;
        requestedBy: string;
        cursor?: Partial<ClusterTransferJobCursor>;
        stats?: Partial<ClusterTransferJobStats>;
        errorCode?: string | null;
        errorMessage?: string | null;
        startedAt?: Date | null;
        finishedAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
    }
): ClusterTransferJobProps => {
    const now = input.createdAt ?? input.updatedAt ?? new Date();
    const defaultCursor = createDefaultClusterTransferJobCursor();
    const defaultStats = createDefaultClusterTransferJobStats();

    return {
        team: input.team,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        sourceClusterId: input.sourceClusterId,
        destinationClusterId: input.destinationClusterId,
        buckets: input.buckets,
        state: input.state ?? ClusterTransferJobState.Queued,
        reason: input.reason ?? ClusterTransferJobReason.Manual,
        cleanupSource: input.cleanupSource ?? true,
        requestedBy: input.requestedBy,
        cursor: {
            bucketIndex: input.cursor?.bucketIndex ?? defaultCursor.bucketIndex,
            lastObjectKey: input.cursor?.lastObjectKey ?? defaultCursor.lastObjectKey
        },
        stats: {
            copiedObjects: input.stats?.copiedObjects ?? defaultStats.copiedObjects,
            copiedBytes: input.stats?.copiedBytes ?? defaultStats.copiedBytes,
            verifiedObjects: input.stats?.verifiedObjects ?? defaultStats.verifiedObjects,
            verifiedBytes: input.stats?.verifiedBytes ?? defaultStats.verifiedBytes,
            deletedObjects: input.stats?.deletedObjects ?? defaultStats.deletedObjects
        },
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now
    };
};

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
