import mongoose, { Schema } from 'mongoose';

interface PluginSubListingRowObject {
    [key: string]: PluginSubListingRowValue;
}

type PluginSubListingRowValue = null | boolean | number | string | PluginSubListingRowValue[] | PluginSubListingRowObject;

export interface PluginSubListingRowDocument {
    _id: string;
    analysis?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    [key: string]: PluginSubListingRowValue;
};

const pluginSubListingRowSchema = new Schema({}, {
    collection: 'pluginsublistingrows',
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

export const PluginSubListingRowModel = mongoose.models.DaemonPluginSubListingRow
    || mongoose.model<PluginSubListingRowDocument>('DaemonPluginSubListingRow', pluginSubListingRowSchema);
