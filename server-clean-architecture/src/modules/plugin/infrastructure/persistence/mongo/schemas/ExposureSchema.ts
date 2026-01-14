import { Schema } from 'mongoose';

export const ExposureMetaSchema = new Schema({
        plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: true,
        index: true,
        cascade: 'delete'
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        index: true,
        cascade: 'delete'
    },
    analysis: {
        type: Schema.Types.ObjectId,
        ref: 'Analysis',
        required: true,
        index: true,
        cascade: 'delete'
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