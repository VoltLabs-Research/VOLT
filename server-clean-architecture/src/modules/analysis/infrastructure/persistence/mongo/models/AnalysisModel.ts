import mongoose, { Schema, Model, Document } from 'mongoose';
import { AnalysisProps } from '@/src/modules/analysis/domain/entities/Analysis';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type AnalysisRelations = 'trajectory' | 'createdBy' | 'team';

export interface AnalysisDocument extends Persistable<AnalysisProps, AnalysisRelations>, Document{}

const AnalysisSchema: Schema<AnalysisDocument> = new Schema({
    plugin: {
        type: String,
        required: true,
        lowercase: true
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