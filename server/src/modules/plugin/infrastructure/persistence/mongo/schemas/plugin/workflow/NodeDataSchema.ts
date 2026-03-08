import { ArgumentsDataSchema } from './nodes/ArgumentsDataSchema';
import { ContextDataSchema } from './nodes/ContextDataSchema';
import { EntrypointDataSchema } from './nodes/EntrypointDataSchema';
import { ExportDataSchema } from './nodes/ExportDataSchema';
import { ExposureDataSchema } from './nodes/ExposureDataSchema';
import { ForEachDataSchema } from './nodes/ForEachDataSchema';
import { IfStatementDataSchema } from './nodes/IfStatementDataSchema';
import { ModifierDataSchema } from './nodes/ModifierDataSchema';

import { Schema } from 'mongoose';

export const NodeDataSchema = new Schema({
    modifier: ModifierDataSchema,
    arguments: ArgumentsDataSchema,
    context: ContextDataSchema,
    forEach: ForEachDataSchema,
    entrypoint: EntrypointDataSchema,
    exposure: ExposureDataSchema,
    export: ExportDataSchema,
    ifStatement: IfStatementDataSchema
}, { _id: false, strict: false });
