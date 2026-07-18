import { ErrorCodes } from '@core/constants/error-codes';
import type { StoragePlacementProps } from '@modules/cluster/utilities/storage-placement';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

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

/**
 * Relation fields that get ObjectId<->string normalization when converting a
 * raw document into the flat `StoragePlacement` ({ _id, props }) shape below —
 * the same list the deleted StoragePlacementMapper used to carry.
 */
const STORAGE_PLACEMENT_RELATION_KEYS = ['team'] as const;

/**
 * Neutral, flat `{ _id, props }` shape replacing the deleted
 * `StoragePlacement` entity class.
 */
export interface StoragePlacement {
    readonly _id: string;
    props: StoragePlacementProps;
}

/**
 * Converts a raw StoragePlacementModel document into the neutral
 * `StoragePlacement` shape, matching the previous StoragePlacementMapper
 * behavior exactly.
 */
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
