/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import mongoose, { Schema, Model, Document } from 'mongoose';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

export interface IAnalysis extends Document {
    plugin: string;
    clusterId?: string;
    config: any;
    trajectory: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    lastFrameProcessed?: number;
};

const AnalysisSchema: Schema<IAnalysis> = new Schema({
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
    lastFrameProcessed: {
        type: Number
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

AnalysisSchema.plugin(useInverseRelations);
AnalysisSchema.plugin(useCascadeDelete);

const deletePluginArtifacts = async (analysis: IAnalysis | null) => {
    if (!analysis) return;
    const analysisId = analysis._id?.toString();
    if (!analysisId) return;

    const trajectoryValue: any = analysis.trajectory;
    const trajectoryId =
        typeof trajectoryValue === 'string'
            ? trajectoryValue
            : (trajectoryValue?._id?.toString?.() ?? trajectoryValue?.toString?.());

    if (!trajectoryId) return;

    const prefix = [
        'plugins',
        `trajectory-${trajectoryId}`,
        `analysis-${analysisId}`
    ].join('/');

    try {
        await storage.deleteByPrefix(SYS_BUCKETS.PLUGINS, prefix);

        // Delete PluginExposureMeta and PluginListingRow documents
        await Promise.all([
            mongoose.model('PluginExposureMeta').deleteMany({ analysis: analysisId }),
            mongoose.model('PluginListingRow').deleteMany({ analysis: analysisId })
        ]);
    } catch (err) {
        logger.error(`[Analysis] Failed to delete plugin artifacts for analysis ${analysisId}: ${err}`);
    }
};

AnalysisSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    await deletePluginArtifacts(this as unknown as IAnalysis);
    next();
});

AnalysisSchema.pre('findOneAndDelete', { document: false, query: true }, async function (next) {
    const doc = await this.model.findOne(this.getFilter());
    if (doc) {
        await deletePluginArtifacts(doc as unknown as IAnalysis);
    }
    next();
});

AnalysisSchema.pre('deleteMany', { document: false, query: true }, async function (next) {
    const docs = await this.model.find(this.getFilter());
    await Promise.all(docs.map((doc: any) => deletePluginArtifacts(doc)));
    next();
});

const Analysis: Model<IAnalysis> = mongoose.model<IAnalysis>('Analysis', AnalysisSchema);

export default Analysis;
