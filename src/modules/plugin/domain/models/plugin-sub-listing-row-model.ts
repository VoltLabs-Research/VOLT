import mongoose, { Schema } from 'mongoose';

export interface PluginSubListingRowDocument {
    _id: string;
    analysis?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    [key: string]: unknown;
};

const pluginSubListingRowSchema = new Schema({
    _id: {
        type: String,
        required: true
    }
}, {
    collection: 'pluginsublistingrows',
    id: false,
    strict: false
});

pluginSubListingRowSchema.index(
    {
        analysis: 1,
        exposureId: 1,
        timestep: 1,
        subListingName: 1
    },
    { name: 'plugin_sub_listing_analysis_exposure_timestep_name_idx' }
);

export const PluginSubListingRowModel: mongoose.Model<PluginSubListingRowDocument> = mongoose.models.DaemonPluginSubListingRow
    || mongoose.model('DaemonPluginSubListingRow', pluginSubListingRowSchema);
