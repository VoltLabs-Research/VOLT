import { ContextSource } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ContextNode';

import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

export const ContextDataSchema = new Schema({
    source: {
        type: String,
        enum: Object.values(ContextSource),
        required: [true, ValidationCodes.PLUGIN_CONTEXT_SOURCE_REQUIRED],
        default: ContextSource.TrajectoryDumps
    }
}, { _id: false });
