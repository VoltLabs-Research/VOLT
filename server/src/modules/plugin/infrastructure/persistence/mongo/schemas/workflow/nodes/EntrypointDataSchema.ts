import { Schema } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';

export const EntrypointDataSchema = new Schema({
    binary: {
        type: String
    },
    // MinIO object path for the uploaded binary
    binaryObjectPath: {
        type: String
    },
    // Original filename when uploaded
    binaryFileName: {
        type: String
    },
    // SHA256 hash of binary for caching
    binaryHash: {
        type: String
    },
    arguments: {
        type: String
    },
    timeout: {
        type: Number,
        default: 300000
    }
}, { _id: false });
