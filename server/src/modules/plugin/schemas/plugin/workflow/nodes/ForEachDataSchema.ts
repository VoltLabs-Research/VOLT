import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

export const ForEachDataSchema = new Schema({
    iterableSource: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_FOREACH_ITERABLE_SOURCE_REQUIRED]
    }
}, { _id: false });
