import mongoose, { Model, Document } from 'mongoose';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { PluginProps } from '@modules/plugin/domain/entities/Plugin';
import { PluginSchema } from '@modules/plugin/infrastructure/persistence/mongo/schemas/PluginSchema';

type PluginRelations = 'team';
export interface PluginDocument extends Persistable<PluginProps, PluginRelations>, Document { };

PluginSchema.index({
    slug: 'text',
    'modifier.name': 'text',
    'modifier.description': 'text'
});

const PluginModel: Model<PluginDocument> = mongoose.model<PluginDocument>('Plugin', PluginSchema);

export default PluginModel;