import { ArgumentDefinitionSchema } from './workflow/nodes/ArgumentsDataSchema';
import { ExportDataSchema } from './workflow/nodes/ExportDataSchema';
import { ModifierDataSchema } from './workflow/nodes/ModifierDataSchema';
import { WorkflowSchema } from './workflow/WorkflowSchema';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';

import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

export const PluginSchema = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    workflow: {
        type: WorkflowSchema,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_ID_REQUIRED]
    },
    status: {
        type: String,
        enum: Object.values(PluginStatus),
        default: PluginStatus.Draft
    },
    modifier: {
        type: ModifierDataSchema,
        default: null
    },
    exposures: {
        type: [{
            _id: { type: String, required: true },
            name: { type: String, required: true },
            results: { type: String, required: true },
            icon: { type: String },
            hasListing: { type: Boolean, default: true },
            export: { type: ExportDataSchema, default: null }
        }],
        default: []
    },
    arguments: {
        type: [ArgumentDefinitionSchema],
        default: []
    },
    listingExposures: {
        type: {
            pluginName: { type: String, required: true },
            pluginId: { type: String, required: true },
            exposures: {
                type: [{
                    exposureId: { type: String, required: true },
                    name: { type: String, required: true }
                }],
                default: []
            }
        },
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
