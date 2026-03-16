import { Schema } from 'mongoose';

export const PluginNodeDataSchema = new Schema({
    pluginId: {
        type: String
    },
    selectedTeamClusterId: {
        type: String
    },
    selectedTimesteps: [{
        type: Number
    }],
    config: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { _id: false, strict: false });
