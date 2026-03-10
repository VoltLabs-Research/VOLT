import mongoose, { Schema } from 'mongoose';

export interface AnalysisDocument {
    _id: string;
    plugin?: string;
    clusterId?: string;
    teamCluster?: string;
    config?: Record<string, unknown>;
    trajectory?: string;
    createdBy?: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team?: string;
    status?: string;
    createdAt?: Date;
    updatedAt?: Date;
};

const analysisSchema = new Schema({}, {
    collection: 'analysis',
    strict: false
});

export const AnalysisModel = mongoose.models.DaemonAnalysis
    || mongoose.model<AnalysisDocument>('DaemonAnalysis', analysisSchema);
