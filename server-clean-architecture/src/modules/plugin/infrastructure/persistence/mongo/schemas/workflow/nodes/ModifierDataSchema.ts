import { Schema } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';

export const ModifierDataSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_MODIFIER_NAME_REQUIRED]
    },
    icon: {
        type: String
    },
    author: {
        type: String
    },
    license: {
        type: String,
        default: 'MIT'
    },
    version: {
        type: String,
        default: '1.0.0'
    },
    homepage: {
        type: String
    },
    description: {
        type: String
    }
}, { _id: false });

