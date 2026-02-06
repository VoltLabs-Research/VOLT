import { Schema } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';
import { WorkflowSchema } from './workflow/WorkflowSchema';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';

export const PluginSchema = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        inverse: { path: 'plugins', behavior: 'addToSet' }
    },
    slug: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_SLUG_REQUIRED],
        unique: true,
        lowercase: true,
        trim: true
    },
    workflow: {
        type: WorkflowSchema,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_REQUIRED]
    },
    status: {
        type: String,
        enum: Object.values(PluginStatus),
        default: PluginStatus.Draft
    },
    validated: {
        type: Boolean,
        default: false
    },
    validationErrors: [{
        type: String
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});