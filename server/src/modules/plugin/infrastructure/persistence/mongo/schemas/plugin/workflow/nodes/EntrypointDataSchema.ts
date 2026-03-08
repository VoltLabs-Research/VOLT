import { Schema } from 'mongoose';

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
    arguments: {
        type: String
    },
    timeout: {
        type: Number,
        default: 300000
    }
}, { _id: false });
