import { Schema } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';

export const WorkflowEdgeSchema = new Schema({
    id: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_EDGE_ID_REQUIRED]
    },
    source: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_EDGE_SOURCE_REQUIRED]
    },
    sourceHandle: {
        type: String
    },
    target: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_EDGE_TARGET_REQUIRED]
    },
    targetHandle: {
        type: String
    }
}, { _id: false, strict: false });