import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { teamRefField, trajectoryRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Schema } from 'mongoose';
import type { Analysis, AnalysisProps } from '@shared/contracts/types/AnalysisProps';
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
    pipelineStageHash: {
        type: String,
        required: false,
        index: true
    },
    totalFrames: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },
    artifactStatus: {
        type: String,
        enum: ['pending', 'generating', 'uploading', 'ready', 'failed'],
        default: 'pending'
    },
    expectedArtifacts: [{
        exposureId: { type: String, required: true },
        name: { type: String, required: true },
        pluginId: { type: String },
        exporter: { type: String },
        exportType: { type: String },
        status: {
            type: String,
            enum: ['pending', 'generating', 'uploading', 'ready', 'failed'],
            default: 'pending'
        },
        isPrimary: { type: Boolean, default: false },
        objectName: { type: String },
        readyAt: { type: Date }
    }],
    stages: [{
        stageKey: { type: String, required: true },
        label: { type: String, required: true },
        type: {
            type: String,
            enum: ['system', 'plugin-ref', 'entrypoint', 'exposure', 'artifact-upload'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'running', 'completed', 'failed', 'cached'],
            required: true
        },
        timestep: { type: Number },
        pluginId: { type: String },
        pluginDisplayName: { type: String },
        nodeId: { type: String },
        exposureId: { type: String },
        configHash: { type: String },
        cacheHit: { type: Boolean },
        detail: { type: String },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        durationMs: { type: Number }
    }],
    childAnalyses: [{
        id: { type: String, required: true },
        pluginId: { type: String, required: true },
        pluginDisplayName: { type: String },
        configHash: { type: String },
        timestep: { type: Number },
        status: {
            type: String,
            enum: ['pending', 'running', 'completed', 'failed', 'cached'],
            required: true
        },
        cacheHit: { type: Boolean },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        durationMs: { type: Number }
    }],
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
AnalysisSchema.index({ team: 1, storageClusterId: 1, createdAt: 1 });

const AnalysisModel: Model<AnalysisDocument> = mongoose.model<AnalysisDocument>('Analysis', AnalysisSchema);

/**
 * Relation fields that get ObjectId<->string normalization when converting a
 * raw document into the flat `Analysis` ({ _id, props }) shape below — the
 * same list the deleted AnalysisMapper used to carry.
 */
const ANALYSIS_RELATION_KEYS = [
    'createdBy',
    'trajectory',
    'plugin',
    'computeClusterId',
    'storageClusterId',
    'team'
] as const;

/**
 * Converts a raw AnalysisModel document into the neutral `{ _id, props }`
 * shape (`Analysis` from `@shared/contracts/types/AnalysisProps`) that
 * cross-module consumers and event payloads still expect. Unpopulated
 * relation fields (plain `Types.ObjectId`) are stringified; populated
 * sub-documents are left as-is, matching the previous AnalysisMapper
 * behavior exactly.
 */
export const toAnalysisLike = (doc: AnalysisDocument): Analysis => {
    const documentProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
    const { _id, __v: _ignoredVersion, ...rest } = documentProps;

    for (const key of ANALYSIS_RELATION_KEYS) {
        const value = Reflect.get(doc, key);

        if (!value) continue;
        if (doc.populated(key)) continue;

        rest[key] = String(value);
    }

    return {
        _id: String(_id),
        props: rest as unknown as AnalysisProps
    };
};

export default AnalysisModel;
