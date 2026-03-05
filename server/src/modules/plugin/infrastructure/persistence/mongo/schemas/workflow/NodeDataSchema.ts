import { Schema } from 'mongoose';
import { ModifierDataSchema } from './nodes/ModifierDataSchema';
import { ArgumentsDataSchema } from './nodes/ArgumentsDataSchema';
import { ContextDataSchema } from './nodes/ContextDataSchema';
import { ForEachDataSchema } from './nodes/ForEachDataSchema';
import { EntrypointDataSchema } from './nodes/EntrypointDataSchema';
import { ExposureDataSchema } from './nodes/ExposuredataSchema';
import { ExportDataSchema } from './nodes/ExportDataSchema';
import { IfStatementDataSchema } from './nodes/IfStatementDataSchema';

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