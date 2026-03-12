import mongoose, { Schema, Model, Document } from 'mongoose';

import { SceneArtifactSourceType, SceneArtifactStatus } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type SceneArtifactRelations = 'trajectory' | 'teamCluster' | 'analysis' | 'plugin';

export interface SceneArtifactDocument extends Persistable<SceneArtifactProps, SceneArtifactRelations>, Document {};

const SceneArtifactSchema: Schema<SceneArtifactDocument> = new Schema({
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        index: true,
        cascade: 'delete'
    },
    teamCluster: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true,
        index: true
    },
    analysis: {
        type: Schema.Types.ObjectId,
        ref: 'Analysis',
        required: false,
        index: true,
        cascade: 'delete'
    },
    plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: false,
        index: true,
        cascade: 'delete'
    },
    sourceType: {
        type: String,
        required: true,
        enum: Object.values(SceneArtifactSourceType),
        index: true
    },
    timestep: {
        type: Number,
        required: true,
        index: true
    },
    objectName: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    storageBucket: {
        type: String,
        required: true
    },
    params: {
        type: Schema.Types.Mixed,
        default: {}
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: Object.values(SceneArtifactStatus),
        default: SceneArtifactStatus.Ready,
        required: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    minimize: false
});

SceneArtifactSchema.index({ trajectory: 1, sourceType: 1, createdAt: -1 }, { name: 'trajectory_source_created_idx' });
SceneArtifactSchema.index({ trajectory: 1, timestep: 1, sourceType: 1 }, { name: 'trajectory_timestep_source_idx' });
SceneArtifactSchema.index({ analysis: 1, sourceType: 1, createdAt: -1 }, { name: 'analysis_source_created_idx' });

const SceneArtifactModel: Model<SceneArtifactDocument> = mongoose.model<SceneArtifactDocument>('TrajectorySceneArtifact', SceneArtifactSchema);

export default SceneArtifactModel;
