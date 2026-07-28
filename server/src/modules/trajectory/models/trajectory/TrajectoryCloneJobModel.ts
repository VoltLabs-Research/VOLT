import { ErrorCodes } from '@core/constants/error-codes';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';

export type TrajectoryCloneJobState =
    | 'queued'
    | 'preparing'
    | 'copying'
    | 'completed'
    | 'failed';

export interface TrajectoryCloneJobStats {
    totalFrames: number;
    copiedFrames: number;
    copiedBytes: number;
}

export interface TrajectoryCloneJobProps {
    team: string;
    sourceTrajectoryId: string;
    destinationTrajectoryId: string;
    sourceClusterId?: string | null;
    destinationClusterId: string;
    state: TrajectoryCloneJobState;
    stats: TrajectoryCloneJobStats;
    requestedBy: string;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export const createDefaultTrajectoryCloneJobStats = (): TrajectoryCloneJobStats => ({
    totalFrames: 0,
    copiedFrames: 0,
    copiedBytes: 0
});

export const createTrajectoryCloneJobProps = (
    input: {
        team: string;
        sourceTrajectoryId: string;
        destinationTrajectoryId: string;
        sourceClusterId?: string | null;
        destinationClusterId: string;
        state?: TrajectoryCloneJobState;
        stats?: Partial<TrajectoryCloneJobStats>;
        requestedBy: string;
        errorCode?: string | null;
        errorMessage?: string | null;
        startedAt?: Date | null;
        finishedAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
    }
): TrajectoryCloneJobProps => {
    const now = input.createdAt ?? input.updatedAt ?? new Date();
    const defaultStats = createDefaultTrajectoryCloneJobStats();

    return {
        team: input.team,
        sourceTrajectoryId: input.sourceTrajectoryId,
        destinationTrajectoryId: input.destinationTrajectoryId,
        sourceClusterId: input.sourceClusterId ?? null,
        destinationClusterId: input.destinationClusterId,
        state: input.state ?? 'queued',
        stats: {
            totalFrames: input.stats?.totalFrames ?? defaultStats.totalFrames,
            copiedFrames: input.stats?.copiedFrames ?? defaultStats.copiedFrames,
            copiedBytes: input.stats?.copiedBytes ?? defaultStats.copiedBytes
        },
        requestedBy: input.requestedBy,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now
    };
};

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

TrajectoryCloneJobSchema.index({
    team: 1,
    state: 1,
    updatedAt: 1
});
TrajectoryCloneJobSchema.index({
    destinationTrajectoryId: 1,
    state: 1
});

const TrajectoryCloneJobModel: Model<TrajectoryCloneJobDocument> = mongoose.model<TrajectoryCloneJobDocument>(
    'TrajectoryCloneJob',
    TrajectoryCloneJobSchema
);

export default TrajectoryCloneJobModel;
