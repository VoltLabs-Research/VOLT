import mongoose, { Schema } from 'mongoose';

export interface PluginListingRowDocument {
    _id: string;
    plugin?: string;
    team?: string;
    trajectory?: string;
    analysis?: string;
    exposureId?: string;
    exposureName?: string;
    trajectoryName?: string;
    timestep?: number;
    [key: string]: unknown;
};

const pluginListingRowSchema = new Schema({}, {
    collection: 'pluginlistingrows',
    strict: false
});

export const PluginListingRowModel = mongoose.models.DaemonPluginListingRow
    || mongoose.model<PluginListingRowDocument>('DaemonPluginListingRow', pluginListingRowSchema);
