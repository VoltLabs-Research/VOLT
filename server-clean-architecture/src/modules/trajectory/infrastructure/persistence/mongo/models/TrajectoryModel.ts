import mongoose, { Schema, Model, Document } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { TrajectoryProps, TrajectoryFrame, TrajectoryStatus } from '../../../../domain/entities/Trajectory';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type TrajectoryRelations = 'createdBy' | 'team' | 'analysis';
type TrajectoryFrameRelations = 'simulationCell';

export interface TrajectoryDocument extends Persistable<TrajectoryProps, TrajectoryRelations>, Document { }
export interface TrajectoryFrameDocument extends Persistable<TrajectoryFrame, TrajectoryFrameRelations>, Document { }

const TimestepInfoSchema: Schema<TrajectoryFrameDocument> = new Schema({
    timestep: {
        type: Number,
        required: true
    },
    natoms: {
        type: Number,
        required: true
    },
    simulationCell: {
        type: Schema.Types.ObjectId,
        ref: 'SimulationCell',
        required: true
    }
}, { _id: false });

const TrajectorySchema: Schema<TrajectoryDocument> = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.TRAJECTORY_NAME_REQUIRED],
        minlength: [4, ValidationCodes.TRAJECTORY_NAME_MINLEN],
        maxlength: [64, ValidationCodes.TRAJECTORY_NAME_MAXLEN],
        trim: true
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        inverse: { path: 'trajectories', behavior: 'addToSet' }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        lowercase: true,
        enum: Object.values(TrajectoryStatus),
        default: TrajectoryStatus.Queued
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    analysis: [{
        type: Schema.Types.ObjectId,
        ref: 'Analysis',
        cascade: 'delete',
        inverse: { path: 'trajectory', behavior: 'set' },
        default: []
    }],
    frames: [TimestepInfoSchema],
    rasterSceneViews: {
        type: Number,
        default: 0
    },
    stats: {
        totalFiles: { type: Number, default: 0 },
        totalSize: { type: Number, default: 0 }
    },
    uploadId: {
        type: String,
        select: true
    }
}, {
    timestamps: true,
});

TrajectorySchema.index({ name: 'text', status: 'text' });

const TrajectoryModel: Model<TrajectoryDocument> = mongoose.model('Trajectory', TrajectorySchema);

export default TrajectoryModel;