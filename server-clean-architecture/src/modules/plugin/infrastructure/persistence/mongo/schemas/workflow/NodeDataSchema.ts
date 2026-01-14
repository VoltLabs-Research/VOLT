import { Schema } from 'mongoose';
import { ModifierDataSchema } from './nodes/ModifierDataSchema';
import { ArgumentsDataSchema } from './nodes/ArgumentsDataSchema';
import { ContextDataSchema } from './nodes/ContextDataSchema';
import { ForEachDataSchema } from './nodes/ForEachDataSchema';
import { EntrypointDataSchema } from './nodes/EntrypointDataSchema';
import { ExposureDataSchema } from './nodes/ExposuredataSchema';
import { SchemaDataSchema } from './nodes/SchemaDataSchema';
import { VisualizersDataSchema } from './nodes/VisualizersDataSchema';
import { ExportDataSchema } from './nodes/ExportDataSchema';
import { IfStatementDataSchema } from './nodes/IfStatementDataSchema';

export const NodeDataSchema = new Schema({
    modifier: ModifierDataSchema,
    arguments: ArgumentsDataSchema,
    context: ContextDataSchema,
    forEach: ForEachDataSchema,
    entrypoint: EntrypointDataSchema,
    exposure: ExposureDataSchema,
    schema: SchemaDataSchema,
    visualizers: VisualizersDataSchema,
    export: ExportDataSchema,
    ifStatement: IfStatementDataSchema
}, { _id: false });