import Plugin, { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import PluginModel, { PluginDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/plugin/PluginModel';
import pluginMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/plugin/PluginMapper';

import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class PluginRepository
    extends MongooseBaseRepository<Plugin, PluginProps, PluginDocument>
    implements IPluginRepository {
    constructor() {
        super(PluginModel, pluginMapper);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);
        return !!result;
    }
    async delete(id: string): Promise<void> {
        await this.deleteById(id);
    }

    async update(id: string, updates: Partial<PluginProps>): Promise<Plugin | null> {
        return this.updateById(id, updates);
    }
};
