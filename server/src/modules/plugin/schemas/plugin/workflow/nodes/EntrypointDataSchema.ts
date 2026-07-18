import { Schema } from 'mongoose';
import { EntrypointNodeType } from '@modules/plugin/entities/plugin/workflow/nodes/EntrypointNode';

export const EntrypointDataSchema = new Schema({
    binary: {
        type: String
    },
    binaryObjectPath: {
        type: String
    },
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
    }
}, { _id: false });
