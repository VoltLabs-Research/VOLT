export type ClusterTransferJobScopeType = 'trajectory' | 'analysis' | 'plugin-binary';

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

export type ClusterTransferJobReason = 'manual' | 'soft-limit' | 'hard-limit';

export interface ClusterTransferJobBucketRef {
    bucket: string;
    prefix: string;
}

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

export interface ClusterTransferJob {
    _id: string;
    team: string;
    scopeType: ClusterTransferJobScopeType;
    scopeId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    buckets: ClusterTransferJobBucketRef[];
    state: ClusterTransferJobState;
    reason: ClusterTransferJobReason;
    cleanupSource: boolean;
    requestedBy: string;
    cursor: ClusterTransferJobCursor;
    stats: ClusterTransferJobStats;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: Date | string | null;
    finishedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
}
