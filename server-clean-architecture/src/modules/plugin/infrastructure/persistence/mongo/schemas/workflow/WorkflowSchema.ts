import { Schema } from 'mongoose';
import { WorkflowNodeSchema } from './WorkflowNodeSchema';
import { WorkflowEdgeSchema } from './WorkflowEdgeSchema';
import { ViewportSchema } from './ViewportSchema';

export const WorkflowSchema = new Schema({
    nodes: {
        type: [Schema.Types.Mixed],
        default: []
    },
    edges: {
        type: [Schema.Types.Mixed],
        default: []
    },
    viewport: {
        type: ViewportSchema,
        default: {}
    }
}, { _id: false });