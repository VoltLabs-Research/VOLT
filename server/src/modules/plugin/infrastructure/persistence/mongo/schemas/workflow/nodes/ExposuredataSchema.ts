import { Schema } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';

export const ExposureDataSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_EXPOSURE_NAME_REQUIRED]
    },
    icon: {
        type: String
    },
    results: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_EXPOSURE_RESULTS_REQUIRED]
    },
    iterable: {
        type: String
    }
}, { _id: false });

