import { Schema } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';

export const ForEachDataSchema = new Schema({
    iterableSource: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_FOREACH_ITERABLE_SOURCE_REQUIRED]
    }
}, { _id: false });
