import { ErrorCodes } from '@core/constants/error-codes';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

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

type ClusterTransferJobRelations = 'team';

export interface ClusterTransferJobDocument extends Persistable<ClusterTransferJobProps, ClusterTransferJobRelations>, Document {}

const CLUSTER_TRANSFER_JOB_VALIDATION_ERROR = ErrorCodes.VALIDATION_INVALID_INPUT;

const storagePlacementBucketRefSchema = new Schema({
    bucket: {
        type: String,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    prefix: {
        type: String,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const cursorSchema = new Schema({
    bucketIndex: {
        type: Number,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    lastObjectKey: {
        type: String,
        default: null
    }
}, {
    _id: false
});

const statsSchema = new Schema({
    copiedObjects: {
        type: Number,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    copiedBytes: {
        type: Number,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    verifiedObjects: {
        type: Number,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    verifiedBytes: {
        type: Number,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    deletedObjects: {
        type: Number,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const ClusterTransferJobSchema = new Schema({
    team: {
        ...teamRefField([true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]),
        index: true
    },
    scopeType: {
        type: String,
        enum: ['trajectory', 'analysis', 'plugin-binary'],
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR]
    },
    scopeId: {
        type: String,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        index: true
    },
    sourceClusterId: {
        type: String,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        index: true
    },
    destinationClusterId: {
        type: String,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        index: true
    },
    buckets: {
        type: [storagePlacementBucketRefSchema],
        default: []
    },
    state: {
        type: String,
        enum: ['queued', 'freezing', 'copying', 'verifying', 'switching', 'cleaning', 'completed', 'failed', 'cancelled'],
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 'queued'
    },
    reason: {
        type: String,
        enum: ['manual', 'soft-limit', 'hard-limit'],
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: 'manual'
    },
    cleanupSource: {
        type: Boolean,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: true
    },
    requestedBy: {
        type: String,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        index: true
    },
    cursor: {
        type: cursorSchema,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: () => ({ bucketIndex: 0, lastObjectKey: null })
    },
    stats: {
        type: statsSchema,
        required: [true, CLUSTER_TRANSFER_JOB_VALIDATION_ERROR],
        default: () => ({
            copiedObjects: 0,
            copiedBytes: 0,
            verifiedObjects: 0,
            verifiedBytes: 0,
            deletedObjects: 0
        })
    },
    errorCode: {
        type: String,
        default: null
    },
    errorMessage: {
        type: String,
        default: null
    },
    startedAt: {
        type: Date,
        default: null
    },
    finishedAt: {
        type: Date,
        default: null
    },
    claimedBy: {
        type: String,
        default: null
    },
    claimExpiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

ClusterTransferJobSchema.index({ team: 1, state: 1, updatedAt: 1 });
ClusterTransferJobSchema.index({ team: 1, scopeType: 1, scopeId: 1, state: 1 });
ClusterTransferJobSchema.index({ destinationClusterId: 1, state: 1, updatedAt: 1 });
ClusterTransferJobSchema.index(
    { scopeType: 1, scopeId: 1, state: 1 },
    {
        unique: true,
        partialFilterExpression: {
            state: { $in: ['queued', 'freezing', 'copying', 'verifying', 'switching', 'cleaning'] }
        }
    }
);

const ClusterTransferJobModel: Model<ClusterTransferJobDocument> = mongoose.model<ClusterTransferJobDocument>(
    'ClusterTransferJob',
    ClusterTransferJobSchema
);

const CLUSTER_TRANSFER_JOB_RELATION_KEYS = ['team'] as const;

export interface ClusterTransferJob {
    readonly _id: string;
    readonly id: string;
    props: ClusterTransferJobProps;
}

export const toClusterTransferJobLike = (doc: ClusterTransferJobDocument): ClusterTransferJob => {
    const documentProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
    const { _id, __v: _ignoredVersion, ...rest } = documentProps;

    for (const key of CLUSTER_TRANSFER_JOB_RELATION_KEYS) {
        const value = Reflect.get(doc, key);

        if (!value) continue;
        if (doc.populated(key)) continue;

        rest[key] = String(value);
    }

    const id = String(_id);

    return {
        _id: id,
        id,
        props: rest as unknown as ClusterTransferJobProps
    };
};

export default ClusterTransferJobModel;
