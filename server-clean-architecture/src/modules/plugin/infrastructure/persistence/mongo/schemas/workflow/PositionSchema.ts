import { Schema } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';

export const PositionSchema = new Schema({
    x: {
        type: Number,
        required: [true, ValidationCodes.PLUGIN_POSITION_X_REQUIRED],
        default: 0
    },
    y: {
        type: Number,
        required: [true, ValidationCodes.PLUGIN_POSITION_Y_REQUIRED],
        default: 0
    }
});
