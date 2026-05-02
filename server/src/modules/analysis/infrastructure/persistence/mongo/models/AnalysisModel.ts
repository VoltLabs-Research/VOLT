import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, trajectoryRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Schema } from 'mongoose';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { Document, Model } from 'mongoose';

enum AnalysisRelation {
    Plugin = 'plugin',
    Trajectory = 'trajectory',
    CreatedBy = 'createdBy',
    Team = 'team',
    ComputeCluster = 'computeClusterId',
    StorageCluster = 'storageClusterId'
}

type AnalysisRelations = `${AnalysisRelation}`;

export interface AnalysisDocument extends Persistable<
    AnalysisProps,
    AnalysisRelations
>, Document {}

const AnalysisSchema = new Schema<AnalysisDocument>({
    plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: true
    },
    pluginDisplayName: {
        type: String,
        required: true,
        trim: true
    },
    computeClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: false,
        index: true
    },
    storageClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: false,
        index: true
    },
    config: {
        type: Schema.Types.Mixed,
        required: true
    },
    totalFrames: {
        type: Number,
        default: 0
    },
    completedFrames: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },
    startedAt: {
        type: Date
    },
    finishedAt: {
        type: Date
    },
    team: {
        ...teamRefField()
    },
    trajectory: {
        ...trajectoryRefField()
    },
    createdBy: {
        ...userRefField()
    }
}, {
    timestamps: true
});

AnalysisSchema.index({ pluginDisplayName: 'text' });
AnalysisSchema.index({ team: 1, createdAt: -1 });
AnalysisSchema.index({ trajectory: 1, createdAt: -1 });
AnalysisSchema.index({ plugin: 1, team: 1, trajectory: 1, computeClusterId: 1 });
AnalysisSchema.index({ trajectory: 1, storageClusterId: 1, createdAt: -1 });

const AnalysisModel: Model<AnalysisDocument> = mongoose.model<AnalysisDocument>('Analysis', AnalysisSchema);

export default AnalysisModel;
