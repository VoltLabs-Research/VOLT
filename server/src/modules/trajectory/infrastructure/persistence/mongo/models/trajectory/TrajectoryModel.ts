import { ValidationCodes } from '@core/constants/validation-codes';
import { TrajectoryProps, TrajectoryFrame, TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

import mongoose, { Schema, Model, Document } from 'mongoose';

type TrajectoryRelations = 'createdBy' | 'team' | 'storageClusterId';
type TrajectoryFrameRelations = 'simulationCell';

export interface TrajectoryDocument extends Persistable<TrajectoryProps, TrajectoryRelations>, Document { };
interface TrajectoryFrameDocument extends Persistable<TrajectoryFrame, TrajectoryFrameRelations>, Document { };

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
        minlength: [1, ValidationCodes.TRAJECTORY_NAME_MINLEN],
        maxlength: [64, ValidationCodes.TRAJECTORY_NAME_MAXLEN],
        trim: true
    },
    team: {
        ...teamRefField(true),
        inverse: { path: 'trajectories', behavior: 'addToSet' }
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'CatalogFolder',
        required: false,
        default: null
    },
    storageClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true,
        index: true
    },
    createdBy: {
        ...userRefField(true)
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
    frames: [TimestepInfoSchema],
    rasterSceneViews: {
        type: Number,
        default: 0
    },
    hasPreview: {
        type: Boolean,
        default: false
    },
    stats: {
        totalFiles: { type: Number, default: 0 },
        totalSize: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
});

TrajectorySchema.index({ name: 'text', status: 'text' });
TrajectorySchema.index({ team: 1, folder: 1, createdAt: -1 });
TrajectorySchema.index({ team: 1, storageClusterId: 1, createdAt: -1 });

const TrajectoryModel: Model<TrajectoryDocument> = mongoose.model('Trajectory', TrajectorySchema);

export default TrajectoryModel;
