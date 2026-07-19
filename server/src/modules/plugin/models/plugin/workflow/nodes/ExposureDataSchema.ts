import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

const ExposurePropertySchema = new Schema({
    key: {
        type: String,
        required: true
    },
    label: {
        type: String
    },
    type: {
        type: String
    }
}, { _id: false });

export const ExposureDataSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_EXPOSURE_NAME_REQUIRED]
    },
    icon: {
        type: String
    },
    id: {
        type: String
    },
    results: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_EXPOSURE_RESULTS_REQUIRED]
    },
    hasListing: {
        type: Boolean,
        default: true
    },
    properties: {
        type: [ExposurePropertySchema],
        default: undefined
    }
}, { _id: false });
