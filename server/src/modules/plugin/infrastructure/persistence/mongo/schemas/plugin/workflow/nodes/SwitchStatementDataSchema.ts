import { Schema } from 'mongoose';

export const SwitchStatementDataSchema = new Schema({
    expression: {
        type: String,
        default: ''
    }
}, { _id: false });

export const SwitchCaseDataSchema = new Schema({
    value: {
        type: String,
        default: ''
    },
    defaultCase: {
        type: Boolean,
        default: false
    }
}, { _id: false });
