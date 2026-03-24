import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/infrastructure/contracts/team-cluster';

export type ClusterTransferJobState =
    | 'queued'
    | 'freezing'
    | 'copying'
    | 'verifying'
    | 'switching'
    | 'cleaning'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type ClusterTransferJobReason =
    | 'manual'
    | 'soft-limit'
    | 'hard-limit';

export interface ClusterTransferJobCursor {
    bucketIndex: number;
    lastObjectKey: string | null;
}

export interface ClusterTransferJobStats {
    copiedObjects: number;
    copiedBytes: number;
    verifiedObjects: number;
    verifiedBytes: number;
    deletedObjects: number;
}

export interface ClusterTransferJobProps {
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

export const createDefaultClusterTransferJobCursor = (): ClusterTransferJobCursor => ({
    bucketIndex: 0,
    lastObjectKey: null
});

export const createDefaultClusterTransferJobStats = (): ClusterTransferJobStats => ({
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
        state?: ClusterTransferJobState;
        reason?: ClusterTransferJobReason;
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
        state: input.state ?? 'queued',
        reason: input.reason ?? 'manual',
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

export default class ClusterTransferJob {
    constructor(
        public readonly _id: string,
        public props: ClusterTransferJobProps
    ) {}

    get id(): string {
        return this._id;
    }
}
