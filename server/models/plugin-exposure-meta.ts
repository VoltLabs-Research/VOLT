import mongoose, { Schema, Model } from 'mongoose';

export interface IPluginExposureMeta{
    plugin: mongoose.Types.ObjectId | string;
    trajectory: mongoose.Types.ObjectId | string;
    analysis: mongoose.Types.ObjectId | string;
    exposureId: string;
    timestep: number;
    metadata: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
};

const PluginExposureMetaSchema = new Schema<IPluginExposureMeta>({
    plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: true,
        index: true
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        index: true
    },
    analysis: {
        type: Schema.Types.ObjectId,
        ref: 'Analysis',
        required: true,
        index: true
    },
    exposureId: {
        type: String,
        required: true,
        index: true
    },
    timestep: {
        type: Number,
        required: true,
        index: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    minimize: false
});

PluginExposureMetaSchema.index(
    { analysis: 1, exposureId: 1, timestep: 1 },
    { unique: true }
);

PluginExposureMetaSchema.index(
    { analysis: 1, timestep: 1 },
    { name: 'analysis_timestep_idx' }
);

PluginExposureMetaSchema.index(
    { analysis: 1, exposureId: 1, timestep: 1 },
    { name: 'analysis_exposure_timestep_idx' }
);

const PluginExposureMeta: Model<IPluginExposureMeta> = mongoose.model<IPluginExposureMeta>('PluginExposureMeta', PluginExposureMetaSchema);

export default PluginExposureMeta;