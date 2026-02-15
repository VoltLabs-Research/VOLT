import mongoose, { Schema, Model, Document } from 'mongoose';
import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type AnalysisRelations = 'trajectory' | 'createdBy' | 'team';

export interface AnalysisDocument extends Persistable<AnalysisProps, AnalysisRelations>, Document { }

const AnalysisSchema: Schema<AnalysisDocument> = new Schema({
    plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: true
    },
    clusterId: {
        type: String,
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
    startedAt: Date,
    finishedAt: Date,
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        cascade: 'delete',
        inverse: { path: 'analysis', behavior: 'addToSet' }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

AnalysisSchema.index({ plugin: 'text' });

const AnalysisModel: Model<AnalysisDocument> = mongoose.model<AnalysisDocument>('Analysis', AnalysisSchema);

export default AnalysisModel;