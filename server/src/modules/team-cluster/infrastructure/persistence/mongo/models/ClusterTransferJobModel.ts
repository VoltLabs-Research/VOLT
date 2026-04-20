import { ErrorCodes } from '@core/constants/error-codes';
import type { ClusterTransferJobProps } from '@modules/team-cluster/domain/entities/ClusterTransferJob';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

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
// Prevents two running open transfer jobs for the same scope. Idempotent requestTransfer.
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

export default ClusterTransferJobModel;
