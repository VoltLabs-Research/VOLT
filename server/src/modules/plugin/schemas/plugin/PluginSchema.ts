import { ArgumentDefinitionSchema } from './workflow/nodes/ArgumentsDataSchema';
import { ExportDataSchema } from './workflow/nodes/ExportDataSchema';
import { ModifierDataSchema } from './workflow/nodes/ModifierDataSchema';
import { WorkflowSchema } from './workflow/WorkflowSchema';

import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

/**
 * Defined here (rather than in `PluginModel.ts`, which is where the rest of the
 * `Plugin` domain shape now lives after the entity/repository ceremony was
 * removed) to avoid a require cycle: `PluginModel.ts` imports this file's
 * `PluginSchema` value to build the model, so this file cannot import back from
 * `PluginModel.ts`. `PluginModel.ts` re-exports this enum so consumers can keep
 * importing everything plugin-shaped from one place.
 */
export enum PluginStatus {
    Draft = 'draft',
    Published = 'published',
    Disabled = 'disabled'
}

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
            id: { type: String },
            name: { type: String, required: true },
            results: { type: String, required: true },
            icon: { type: String },
            hasListing: { type: Boolean, default: true },
            properties: {
                type: [{
                    key: { type: String, required: true },
                    label: { type: String },
                    type: { type: String }
                }],
                default: []
            },
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
