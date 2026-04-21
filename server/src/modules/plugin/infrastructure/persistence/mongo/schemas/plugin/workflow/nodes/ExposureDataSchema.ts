import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

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
    }
}, { _id: false });
