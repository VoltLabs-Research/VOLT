import {
    ArgumentType,
    ArgumentVisibilityOperators
} from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';

import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

export const ArgumentOptionSchema = new Schema({
    key: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_OPT_KEY_REQUIRED]
    },
    label: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_OPT_LABEL_REQUIRED]
    }
}, { _id: false });

export const ArgumentVisibilityConditionSchema = new Schema({
    argument: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_ARGUMENT_REQUIRED]
    },
    operator: {
        type: String,
        enum: ArgumentVisibilityOperators,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_TYPE_REQUIRED]
    },
    value: {
        type: Schema.Types.Mixed
    },
    values: [{
        type: Schema.Types.Mixed
    }]
}, { _id: false });

export const ArgumentDefinitionSchema = new Schema({
    argument: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_ARGUMENT_REQUIRED]
    },
    type: {
        type: String,
        enum: Object.values(ArgumentType),
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_TYPE_REQUIRED]
    },
    label: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_LABEL_REQUIRED]
    },
    default: {
        type: Schema.Types.Mixed
    },
    value: {
        type: Schema.Types.Mixed
    },
    options: [ArgumentOptionSchema],
    required: {
        type: Boolean,
        default: false
    },
    multipleSelection: {
        type: Boolean,
        default: false
    },
    pluginReferenceFilter: [{
        type: String
    }],
    pluginReferenceFilterKeys: [{
        type: String
    }],
    showPluginConfiguration: {
        type: Boolean,
        default: false
    },
    min: {
        type: Number
    },
    max: {
        type: Number
    },
    step: {
        type: Number
    },
    visibleWhen: {
        type: ArgumentVisibilityConditionSchema
    }
}, { _id: false });

ArgumentDefinitionSchema.add({
    listArguments: [ArgumentDefinitionSchema]
});

export const ArgumentsDataSchema = new Schema({
    arguments: [ArgumentDefinitionSchema]
}, { _id: false });
