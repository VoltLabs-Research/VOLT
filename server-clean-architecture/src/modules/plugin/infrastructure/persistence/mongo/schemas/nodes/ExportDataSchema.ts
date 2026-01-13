import { Schema } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { Exporter, ExportType } from '@/src/modules/plugin/domain/entities/workflow/nodes/ExportNode';

export const ExportDataSchema = new Schema({
    exporter: {
        type: String,
        enum: Object.values(Exporter),
        required: [true, ValidationCodes.PLUGIN_EXPORT_EXPORTER_REQUIRED]
    },
    type: {
        type: String,
        enum: Object.values(ExportType),
        required: [true, ValidationCodes.PLUGIN_EXPORT_TYPE_REQUIRED]
    },
    options: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });