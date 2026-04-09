import { PluginNodeExecutionMode } from '@modules/plugin/domain/entities/plugin/workflow/nodes/PluginNode';
import { Schema } from 'mongoose';

export const PluginNodeDataSchema = new Schema({
    executionMode: {
        type: String,
        enum: Object.values(PluginNodeExecutionMode),
        default: PluginNodeExecutionMode.Manual
    },
    pluginId: {
        type: String
    },
    argumentReference: {
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
    },
    configByPluginId: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { _id: false, strict: false });
