import { Schema } from 'mongoose';
import { WorkflowNodeSchema } from './WorkflowNodeSchema';
import { WorkflowEdgeSchema } from './WorkflowEdgeSchema';
import { ViewportSchema } from './ViewportSchema';

export const WorkflowSchema = new Schema({
    nodes: {
        type: [WorkflowNodeSchema],
        default: []
    },
    edges: {
        type: [WorkflowEdgeSchema],
        default: []
    },
    viewport: {
        type: ViewportSchema,
        default: {}
    }
}, { _id: false });