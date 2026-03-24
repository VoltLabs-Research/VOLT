import { ErrorCodes } from '@core/constants/error-codes';
import type { StoragePlacementProps } from '@modules/team-cluster/domain/entities/StoragePlacement';
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

export default StoragePlacementModel;
