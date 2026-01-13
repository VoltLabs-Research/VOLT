import { Schema } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';

export const SchemaDataSchema = new Schema({
    definition: {
        type: Schema.Types.Mixed,
        required: [true, ValidationCodes.PLUGIN_SCHEMA_DEFINITION_REQUIRED]
    }
});
