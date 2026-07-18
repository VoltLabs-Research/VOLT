import { ArgumentsDataSchema } from './nodes/ArgumentsDataSchema';
import { ContextDataSchema } from './nodes/ContextDataSchema';
import { EntrypointDataSchema } from './nodes/EntrypointDataSchema';
import { ExportDataSchema } from './nodes/ExportDataSchema';
import { ExposureDataSchema } from './nodes/ExposureDataSchema';
import { ForEachDataSchema } from './nodes/ForEachDataSchema';
import { IfStatementDataSchema } from './nodes/IfStatementDataSchema';
import { ModifierDataSchema } from './nodes/ModifierDataSchema';
import { PluginNodeDataSchema } from './nodes/PluginNodeDataSchema';
import { SwitchCaseDataSchema, SwitchStatementDataSchema } from './nodes/SwitchStatementDataSchema';

import { Schema } from 'mongoose';

export const NodeDataSchema = new Schema({
    modifier: ModifierDataSchema,
    arguments: ArgumentsDataSchema,
    context: ContextDataSchema,
    forEach: ForEachDataSchema,
    entrypoint: EntrypointDataSchema,
    pluginNode: PluginNodeDataSchema,
    exposure: ExposureDataSchema,
    export: ExportDataSchema,
    ifStatement: IfStatementDataSchema,
    switchStatement: SwitchStatementDataSchema,
    switchCase: SwitchCaseDataSchema
}, { _id: false, strict: false });
