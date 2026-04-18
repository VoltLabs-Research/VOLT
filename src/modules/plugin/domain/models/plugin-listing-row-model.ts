import mongoose, { Schema } from 'mongoose';

interface PluginListingRowObject {
    [key: string]: PluginListingRowValue;
}

type PluginListingRowValue = null | boolean | number | string | PluginListingRowValue[] | PluginListingRowObject;

export interface PluginListingRowDocument {
    _id: string;
    plugin?: string;
    team?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
    timestep?: number;
    payloadObjectKey?: string;
    [key: string]: PluginListingRowValue;
};

const pluginListingRowSchema = new Schema({}, {
    collection: 'pluginlistingrows',
    strict: false
});

pluginListingRowSchema.index(
    {
        analysis: 1,
        exposureId: 1,
        timestep: 1
    },
    { name: 'plugin_listing_analysis_exposure_timestep_idx' }
);
pluginListingRowSchema.index(
    { analysis: 1, timestep: -1 },
    { name: 'plugin_listing_analysis_timestep_idx' }
);
pluginListingRowSchema.index(
    {
        plugin: 1,
        trajectory: 1,
        timestep: -1
    },
    { name: 'plugin_listing_plugin_trajectory_timestep_idx' }
);

export const PluginListingRowModel = mongoose.models.DaemonPluginListingRow
    || mongoose.model<PluginListingRowDocument>('DaemonPluginListingRow', pluginListingRowSchema);
