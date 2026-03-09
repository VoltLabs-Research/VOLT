import { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';
import { PluginSchema } from '@modules/plugin/infrastructure/persistence/mongo/schemas/plugin/PluginSchema';

import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Model, Document } from 'mongoose';

type PluginRelations = 'team' | 'teamCluster';
export interface PluginDocument extends Persistable<PluginProps, PluginRelations>, Document { };


const PluginModel: Model<PluginDocument> = mongoose.model<PluginDocument>('Plugin', PluginSchema);

export default PluginModel;
