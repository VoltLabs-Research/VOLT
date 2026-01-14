import { Schema } from 'mongoose';
import { IfStatementConditionType, IfStatementConditionHandler } from '@/src/modules/plugin/domain/entities/workflow/nodes/IfStatementNode';

export const ConditionSchema = new Schema({
    type: {
        type: String,
        enum: Object.values(IfStatementConditionType),
        default: IfStatementConditionType.And
    },
    leftExpr: {
        type: String,
        default: ''
    },
    handler: {
        type: String,
        enum: Object.values(IfStatementConditionHandler),
        default: IfStatementConditionHandler.IsEqualTo
    },
    rightExpr: {
        type: String,
        default: ''
    }
}, { _id: false });

export const IfStatementDataSchema = new Schema({
    conditions: [ConditionSchema]
}, { _id: false });