import mongoose, { Schema, Model, Document } from 'mongoose';
import { teamRefField, userRefField, trajectoryRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type AnalysisRelations = 'plugin' | 'trajectory' | 'createdBy' | 'team';

export interface AnalysisDocument extends Persistable<AnalysisProps, AnalysisRelations>, Document { }

const AnalysisSchema = new Schema<AnalysisDocument>({
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
    startedAt: {
        type: Date
    },
    finishedAt: {
        type: Date
    },
    team: teamRefField() as unknown as AnalysisDocument['team'],
    trajectory: {
        ...(trajectoryRefField() as unknown as Record<string, unknown>),
        cascade: 'delete',
        inverse: { path: 'analysis', behavior: 'addToSet' }
    } as unknown as AnalysisDocument['trajectory'],
    createdBy: userRefField() as unknown as AnalysisDocument['createdBy']
}, {
    timestamps: true
});

AnalysisSchema.index({ plugin: 'text' });

const AnalysisModel: Model<AnalysisDocument> = mongoose.model<AnalysisDocument>('Analysis', AnalysisSchema);

export default AnalysisModel;
