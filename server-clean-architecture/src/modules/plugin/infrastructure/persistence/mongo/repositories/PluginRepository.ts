import { IPluginRepository } from "@/src/modules/plugin/domain/ports/IPluginRepository";
import Plugin, { PluginProps } from "@/src/modules/plugin/domain/entities/Plugin";
import PluginModel, { PluginDocument } from "../models/PluginModel";
import pluginMapper from '../mappers/PluginMapper';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable, inject } from 'tsyringe';
import { IEventBus } from "@/src/shared/application/events/IEventBus";
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import PluginDeletedEvent from "../../../../domain/events/PluginDeletedEvent";

@injectable()
export default class PluginRepository
    extends MongooseBaseRepository<Plugin, PluginProps, PluginDocument>
    implements IPluginRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
        super(PluginModel, pluginMapper);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new PluginDeletedEvent({
                pluginId: id,
                teamId: result.team?.toString(),
                slug: result.slug,
                workflow: result.workflow
            }));
        }

        return !!result;
    }
    async delete(id: string): Promise<void> {
        await this.deleteById(id);
    }

    async update(id: string, updates: Partial<PluginProps>): Promise<Plugin | null> {
        return this.updateById(id, updates);
    }
};