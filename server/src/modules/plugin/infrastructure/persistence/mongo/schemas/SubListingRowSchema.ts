import { Schema } from 'mongoose';

export const SubListingRowSchema = new Schema({
    plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: true,
        index: true,
        cascade: 'delete'
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
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
    exposureName: {
        type: String,
        required: true
    },
    timestep: {
        type: Number,
        required: true,
        index: true
    },
    subListingName: {
        type: String,
        required: true,
        index: true
    },
    row: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});
