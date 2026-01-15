import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import AnalysisDeletedEvent from '../../domain/events/AnalysisDeletedEvent';
import { PLUGIN_TOKENS } from '@/src/modules/plugin/infrastructure/di/PluginTokens';
import { IExposureMetaRepository } from '@/src/modules/plugin/domain/ports/IExposureMetaRepository';
import { IListingRowRepository } from '@/src/modules/plugin/domain/ports/IListingRowRepository';

@injectable()
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent>{
    constructor(
        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private readonly exposureMetaRepository: IExposureMetaRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository
    ){}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId } = event.payload;
        const query = { analysis: analysisId };

        await Promise.all([
            this.exposureMetaRepository.deleteMany(query),
            this.listingRowRepository.deleteMany(query)
        ]);
    }
}
