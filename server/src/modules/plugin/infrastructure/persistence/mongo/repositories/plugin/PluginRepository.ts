import Plugin, { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';
import pluginMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/plugin/PluginMapper';
import PluginModel, { PluginDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/plugin/PluginModel';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';


@Singleton()
export default class PluginRepository
    extends MongooseBaseRepository<Plugin, PluginProps, PluginDocument> {
    constructor() {
        super(PluginModel, pluginMapper);
    }

    async findByIds(ids: string[]): Promise<Plugin[]> {
        if (!ids.length) {
            return [];
        }

        const documents = await this.model.find({
            _id: {
                $in: ids
            }
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }
};
