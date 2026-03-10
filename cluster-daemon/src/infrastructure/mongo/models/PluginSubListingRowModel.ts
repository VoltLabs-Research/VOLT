import mongoose, { Schema } from 'mongoose';

export interface PluginSubListingRowDocument {
    _id: string;
    analysis?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    [key: string]: unknown;
};

const pluginSubListingRowSchema = new Schema({}, {
    collection: 'pluginsublistingrows',
    strict: false
});

export const PluginSubListingRowModel = mongoose.models.DaemonPluginSubListingRow
    || mongoose.model<PluginSubListingRowDocument>('DaemonPluginSubListingRow', pluginSubListingRowSchema);
