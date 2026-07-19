import mongoose, { Schema } from 'mongoose';
import type { Document, Model } from 'mongoose';
import type { AnalysisProvenance } from '@modules/analysis/models/AnalysisMetadata';

export interface AnalysisProvenanceDocument extends Omit<AnalysisProvenance, '_id'>, Document {}

const AnalysisProvenanceSchema = new Schema<AnalysisProvenanceDocument>({
    pluginName: { type: String, required: true, index: true },
    pluginVersion: { type: String, required: true },
    parameters: { type: Schema.Types.Mixed, required: true },
    inputFrameContentHash: { type: String, required: true },
    inputFrameMetadata: {
        atomCount: { type: Number, required: true },
        frameIndex: { type: Number, required: true },
        trajectoryId: { type: String, required: true, index: true }
    },
    coreToolkitVersion: { type: String, required: true },
    rngSeed: { type: Number },
    executedAt: { type: Date, required: true, index: true },
    executedBy: { type: String, required: true },
    executionTimeMs: { type: Number, required: true },
    outputArtifactIds: [{ type: String }],
    reproductionCommand: { type: String, required: true }
}, {
    timestamps: false
});

AnalysisProvenanceSchema.index({ pluginName: 1, pluginVersion: 1, inputFrameContentHash: 1 });
AnalysisProvenanceSchema.index({ 'inputFrameMetadata.trajectoryId': 1, executedAt: -1 });

const AnalysisProvenanceModel: Model<AnalysisProvenanceDocument> = mongoose.model<AnalysisProvenanceDocument>(
    'AnalysisProvenance',
    AnalysisProvenanceSchema
);

export default AnalysisProvenanceModel;
