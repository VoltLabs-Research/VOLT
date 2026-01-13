import { Schema } from 'mongoose';
import { WorkflowNodeSchema } from './WorkflowNodeSchema';
import { WorkflowEdgeSchema } from './WorkflowEdgeSchema';
import { ViewportSchema } from './ViewportSchema';

export const WorkflowSchema = new Schema({
    nodes: [WorkflowNodeSchema],
    edges: [WorkflowEdgeSchema],
    viewport: {
        type: ViewportSchema,
        default: {}
    }
}, { _id: false });