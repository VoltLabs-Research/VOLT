import mongoose, { Schema } from 'mongoose';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';

const PluginListingRowSchema = new Schema({
    plugin: {
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        required: true,
        index: true,
        cascade: 'delete'
    },
    listingSlug: {
        type: String,
        required: true,
        index: true
    },
    exposureId: {
        type: String,
        required: true,
        index: true
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
    timestep: {
        type: Number,
        required: true,
        index: true
    },
    row: {
        type: Schema.Types.Mixed,
        default: {}
    },
    trajectoryName: {
        type: String
    }
}, {
    timestamps: true
});

PluginListingRowSchema.index(
    { plugin: 1, listingSlug: 1, trajectory: 1, analysis: 1, timestep: 1 },
    { unique: true }
);

PluginListingRowSchema.index({ plugin: 1, listingSlug: 1, team: 1, timestep: -1, _id: 1 });

PluginListingRowSchema.plugin(useCascadeDelete);

const PluginListingRow = mongoose.model('PluginListingRow', PluginListingRowSchema);

export default PluginListingRow;
