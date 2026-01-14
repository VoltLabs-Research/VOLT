import { Schema } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { ArgumentType } from '@/src/modules/plugin/domain/entities/workflow/nodes/ArgumentNode';

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
    min: {
        type: Number
    },
    max: {
        type: Number
    },
    step: {
        type: Number
    }
}, { _id: false });

export const ArgumentsDataSchema = new Schema({
    arguments: [ArgumentDefinitionSchema]
}, { _id: false });
