import { ErrorCodes } from '@core/constants/error-codes';
import type { TrajectoryCloneJobProps } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

type TrajectoryCloneJobRelations = 'team';

export interface TrajectoryCloneJobDocument extends Persistable<TrajectoryCloneJobProps, TrajectoryCloneJobRelations>, Document {}

const CLONE_JOB_VALIDATION_ERROR = ErrorCodes.VALIDATION_INVALID_INPUT;

const statsSchema = new Schema({
    totalFrames: {
        type: Number,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLONE_JOB_VALIDATION_ERROR]
    },
    copiedFrames: {
        type: Number,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLONE_JOB_VALIDATION_ERROR]
    },
    copiedBytes: {
        type: Number,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        default: 0,
        min: [0, CLONE_JOB_VALIDATION_ERROR]
    }
}, {
    _id: false
});

const TrajectoryCloneJobSchema = new Schema({
    team: {
        ...teamRefField([true, CLONE_JOB_VALIDATION_ERROR]),
        index: true
    },
    sourceTrajectoryId: {
        type: String,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        index: true
    },
    destinationTrajectoryId: {
        type: String,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        index: true
    },
    sourceClusterId: {
        type: String,
        default: null
    },
    destinationClusterId: {
        type: String,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        index: true
    },
    state: {
        type: String,
        enum: ['queued', 'preparing', 'copying', 'completed', 'failed'],
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        default: 'queued'
    },
    stats: {
        type: statsSchema,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        default: () => ({
            totalFrames: 0,
            copiedFrames: 0,
            copiedBytes: 0
        })
    },
    requestedBy: {
        type: String,
        required: [true, CLONE_JOB_VALIDATION_ERROR],
        index: true
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

TrajectoryCloneJobSchema.index({ team: 1, state: 1, updatedAt: 1 });
TrajectoryCloneJobSchema.index({ destinationTrajectoryId: 1, state: 1 });

const TrajectoryCloneJobModel: Model<TrajectoryCloneJobDocument> = mongoose.model<TrajectoryCloneJobDocument>(
    'TrajectoryCloneJob',
    TrajectoryCloneJobSchema
);

export default TrajectoryCloneJobModel;
