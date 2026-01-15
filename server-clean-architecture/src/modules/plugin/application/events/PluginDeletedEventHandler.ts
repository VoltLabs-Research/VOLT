import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import PluginDeletedEvent from '../../domain/events/PluginDeletedEvent';
import { PLUGIN_TOKENS } from '../../infrastructure/di/PluginTokens';
import { IExposureMetaRepository } from '../../domain/ports/IExposureMetaRepository';
import { IListingRowRepository } from '../../domain/ports/IListingRowRepository';

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
