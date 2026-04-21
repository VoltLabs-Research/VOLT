import { ValidationCodes } from '@core/constants/validation-codes';
import { TrajectoryProps, TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

import mongoose, { Schema, Model, Document } from 'mongoose';

type TrajectoryRelations = 'createdBy' | 'team' | 'storageClusterId';

export interface TrajectoryDocument extends Persistable<TrajectoryProps, TrajectoryRelations>, Document { };

const TrajectorySchema: Schema<TrajectoryDocument> = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.TRAJECTORY_NAME_REQUIRED],
        minlength: [1, ValidationCodes.TRAJECTORY_NAME_MINLEN],
        maxlength: [64, ValidationCodes.TRAJECTORY_NAME_MAXLEN],
        trim: true
    },
    team: {
        ...teamRefField(true)
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
    // Why: frames are now persisted in the `trajectoryframes` collection (see
    // TrajectoryFrameModel). Embedding them here used to make a single
    // trajectory document exceed 1 MB on long simulations and serialized every
    // `$push` through the parent's write lock.
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
