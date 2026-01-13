import { ValidationCodes } from "@/src/core/constants/validation-codes";
import { WorkflowNodeType } from "@/src/modules/plugin/domain/entities/workflow/WorkflowNode";
import { PositionSchema } from "./PositionSchema";
import { NodeDataSchema } from "./NodeDataSchema";
import { Schema } from 'mongoose';

export const WorkflowNodeSchema = new Schema({
    id: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_ID_REQUIRED]
    },
    type: {
        type: String,
        enum: Object.values(WorkflowNodeType),
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_TYPE_REQUIRED]
    },
    position: {
        type: PositionSchema,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_POSITION_REQUIRED]
    },
    data: {
        type: NodeDataSchema,
        default: {}
    }
}, { _id: false });

