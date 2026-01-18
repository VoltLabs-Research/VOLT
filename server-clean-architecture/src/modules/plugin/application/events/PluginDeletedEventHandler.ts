import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IExposureMetaRepository } from '@modules/plugin/domain/ports/IExposureMetaRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';

@injectable()
export default class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    constructor(
        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private readonly exposureMetaRepository: IExposureMetaRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository
    ){}

    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await Promise.all([
            this.exposureMetaRepository.deleteMany(query),
            this.listingRowRepository.deleteMany(query)
        ]);
    }
}
