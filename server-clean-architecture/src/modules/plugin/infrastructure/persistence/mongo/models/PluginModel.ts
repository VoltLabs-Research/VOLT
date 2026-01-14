import mongoose, { Model } from 'mongoose';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';
import { PluginProps } from '@/src/modules/plugin/domain/entities/Plugin';
import { PluginSchema } from '../schemas/PluginSchema';

type PluginRelations = 'team';
export interface PluginDocument extends Persistable<PluginProps, PluginRelations>, Document{};

PluginSchema.index({
    slug: 'text', 
    'modifier.name': 'text', 
    'modifier.description': 'text' 
});

const PluginModel: Model<PluginDocument> = mongoose.model<PluginDocument>('Plugin', PluginSchema);

export default PluginModel;