import { Schema } from 'mongoose';
import { EntrypointNodeType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/EntrypointNode';

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
    type: {
        type: String,
        enum: Object.values(EntrypointNodeType)
    },
    arguments: {
        type: String
    },
    requirementsFile: {
        type: String
    },
    timeout: {
        type: Number,
        default: 300000
    }
}, { _id: false });
