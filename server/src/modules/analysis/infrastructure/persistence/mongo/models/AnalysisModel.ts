import mongoose from 'mongoose';
import { Schema } from 'mongoose';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, trajectoryRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { Document, Model } from 'mongoose';

enum AnalysisRelation {
    Plugin = 'plugin',
    Trajectory = 'trajectory',
    CreatedBy = 'createdBy',
    Team = 'team'
};

type AnalysisRelations = `${AnalysisRelation}`;

interface AnalysisTrajectoryInverse {
    path: string;
    behavior: 'addToSet';
};

const analysisTrajectoryInverse: AnalysisTrajectoryInverse = {
    path: 'analysis',
    behavior: 'addToSet'
};

export interface AnalysisDocument extends Persistable<
    AnalysisProps,
    AnalysisRelations
>, Document {};

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
    team: {
        ...teamRefField()
    },
    trajectory: {
        ...trajectoryRefField(),
        cascade: 'delete',
        inverse: analysisTrajectoryInverse
    },
    createdBy: {
        ...userRefField()
    }
}, {
    timestamps: true
});

AnalysisSchema.index({ plugin: 'text' });

const AnalysisModel: Model<AnalysisDocument> = mongoose.model<AnalysisDocument>('Analysis', AnalysisSchema);

export default AnalysisModel;
