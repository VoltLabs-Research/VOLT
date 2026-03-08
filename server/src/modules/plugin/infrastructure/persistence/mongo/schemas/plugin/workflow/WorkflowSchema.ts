import { ViewportSchema } from './ViewportSchema';
import { WorkflowEdgeSchema } from './WorkflowEdgeSchema';
import { WorkflowNodeSchema } from './WorkflowNodeSchema';

import { Schema } from 'mongoose';

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