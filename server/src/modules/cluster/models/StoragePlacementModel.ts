import { ErrorCodes } from '@core/constants/error-codes';
import type {
    StoragePlacement as StoragePlacementContract,
    StoragePlacementBucketRef,
    StoragePlacementScopeType,
    StoragePlacementState
} from '@shared/domain/contracts/team-cluster';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface StoragePlacementProps extends Omit<StoragePlacementContract, 'lastVerifiedAt' | 'bytesUsed'> {
    team: string;
    lastVerifiedAt: Date | null;
    bytesUsed: number | null;
    lastAccessedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export const DEFAULT_STORAGE_PLACEMENT_STATE: StoragePlacementState = 'active';

export const normalizeStoragePlacementBuckets = (
    buckets: StoragePlacementBucketRef[]
): StoragePlacementBucketRef[] => {
    return buckets
        .filter((bucketRef) => Boolean(bucketRef.bucket))
        .map((bucketRef) => ({
            bucket: bucketRef.bucket,
            prefix: bucketRef.prefix
        }))
        .sort((left, right) => {
            if (left.bucket !== right.bucket) {
                return left.bucket.localeCompare(right.bucket);
            }

            return left.prefix.localeCompare(right.prefix);
        });
};

export const createStoragePlacementProps = (
    input: {
        team: string;
        scopeType: StoragePlacementScopeType;
        scopeId: string;
        primaryClusterId: string;
        replicaClusterIds?: string[];
        buckets: StoragePlacementBucketRef[];
        state?: StoragePlacementState;
        lastVerifiedAt?: Date | null;
        bytesUsed?: number | null;
        lastAccessedAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
    }
): StoragePlacementProps => {
    const now = input.createdAt ?? input.updatedAt ?? new Date();

    return {
        team: input.team,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        primaryClusterId: input.primaryClusterId,
        replicaClusterIds: [...new Set((input.replicaClusterIds ?? []).filter(Boolean))],
        buckets: normalizeStoragePlacementBuckets(input.buckets),
        state: input.state ?? DEFAULT_STORAGE_PLACEMENT_STATE,
        lastVerifiedAt: input.lastVerifiedAt ?? null,
        bytesUsed: typeof input.bytesUsed === 'number' ? input.bytesUsed : null,
        lastAccessedAt: input.lastAccessedAt ?? null,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now
    };
};

export interface StoragePlacementDocument extends Persistable<StoragePlacementProps, 'team'>, Document {}

const STORAGE_PLACEMENT_VALIDATION_ERROR = ErrorCodes.VALIDATION_INVALID_INPUT;

const storagePlacementBucketRefSchema = new Schema({
    bucket: {
        type: String,
        required: [true, STORAGE_PLACEMENT_VALIDATION_ERROR]
    },
    prefix: {
        type: String,
        required: [true, STORAGE_PLACEMENT_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const StoragePlacementSchema = new Schema({
    team: {
        ...teamRefField([true, STORAGE_PLACEMENT_VALIDATION_ERROR]),
        index: true
    },
    scopeType: {
        type: String,
        enum: ['trajectory', 'analysis', 'plugin-binary'],
        required: [true, STORAGE_PLACEMENT_VALIDATION_ERROR]
    },
    scopeId: {
        type: String,
        required: [true, STORAGE_PLACEMENT_VALIDATION_ERROR],
        index: true
    },
    primaryClusterId: {
        type: String,
        required: [true, STORAGE_PLACEMENT_VALIDATION_ERROR],
        index: true
    },
    replicaClusterIds: {
        type: [String],
        default: []
    },
    buckets: {
        type: [storagePlacementBucketRefSchema],
        default: []
    },
    state: {
        type: String,
        enum: ['active', 'moving', 'read-only', 'deleting'],
        required: [true, STORAGE_PLACEMENT_VALIDATION_ERROR],
        default: 'active'
    },
    lastVerifiedAt: {
        type: Date,
        default: null
    },
    bytesUsed: {
        type: Number,
        default: null,
        min: [0, STORAGE_PLACEMENT_VALIDATION_ERROR]
    },
    lastAccessedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

StoragePlacementSchema.index({ scopeType: 1, scopeId: 1 }, { unique: true });
StoragePlacementSchema.index({ team: 1, primaryClusterId: 1, state: 1 });

const StoragePlacementModel: Model<StoragePlacementDocument> = mongoose.model<StoragePlacementDocument>(
    'StoragePlacement',
    StoragePlacementSchema
);

const STORAGE_PLACEMENT_RELATION_KEYS = ['team'] as const;

export interface StoragePlacement {
    readonly _id: string;
    props: StoragePlacementProps;
}

export const toStoragePlacementLike = (doc: StoragePlacementDocument): StoragePlacement => {
    const documentProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
    const { _id, __v: _ignoredVersion, ...rest } = documentProps;

    for (const key of STORAGE_PLACEMENT_RELATION_KEYS) {
        const value = Reflect.get(doc, key);

        if (!value) continue;
        if (doc.populated(key)) continue;

        rest[key] = String(value);
    }

    return {
        _id: String(_id),
        props: rest as unknown as StoragePlacementProps
    };
};

export default StoragePlacementModel;
