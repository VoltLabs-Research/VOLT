import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IExposureMetaRepository } from '@modules/plugin/domain/ports/IExposureMetaRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private readonly exposureMetaRepository: IExposureMetaRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository
    ){}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        const query = { trajectory: trajectoryId };

        await Promise.all([
            this.exposureMetaRepository.deleteMany(query),
            this.listingRowRepository.deleteMany(query)
        ]);
    }
}
