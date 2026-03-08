import { Exporter, ExportType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ExportNode';

import { ValidationCodes } from '@core/constants/validation-codes';
import { Schema } from 'mongoose';

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