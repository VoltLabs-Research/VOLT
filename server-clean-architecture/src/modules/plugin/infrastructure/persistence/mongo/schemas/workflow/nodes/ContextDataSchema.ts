import { Schema } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';
import { ContextSource } from '@modules/plugin/domain/entities/workflow/nodes/ContextNode';

export const ContextDataSchema = new Schema({
    source: {
        type: String,
        enum: Object.values(ContextSource),
        required: [true, ValidationCodes.PLUGIN_CONTEXT_SOURCE_REQUIRED],
        default: ContextSource.TrajectoryDumps
    }
}, { _id: false });
