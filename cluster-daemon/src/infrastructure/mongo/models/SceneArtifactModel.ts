import mongoose, { Schema } from 'mongoose';

export interface SceneArtifactDocument {
    _id: string;
    trajectory: string;
    teamCluster?: string;
    analysis?: string;
    plugin?: string;
    sourceType: string;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
};

const sceneArtifactSchema = new Schema({}, {
    collection: 'trajectorysceneartifacts',
    strict: false
});

export const SceneArtifactModel = mongoose.models.DaemonSceneArtifact
    || mongoose.model<SceneArtifactDocument>('DaemonSceneArtifact', sceneArtifactSchema);
