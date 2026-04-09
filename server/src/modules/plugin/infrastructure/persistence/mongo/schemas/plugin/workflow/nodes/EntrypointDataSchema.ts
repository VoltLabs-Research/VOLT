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
    binaryHash: {
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
    entrypointScript: {
        type: String
    },
    timeout: {
        type: Number,
        default: -1
    }
}, { _id: false });
