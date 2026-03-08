import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject, injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IListingRowRepository } from '@modules/plugin/domain/port/listing-row/IListingRowRepository';
import type { ISubListingRowRepository } from '@modules/plugin/domain/port/listing-row/ISubListingRowRepository';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';

@injectable()
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository,

        @inject(PLUGIN_TOKENS.SubListingRowRepository)
        private readonly subListingRowRepository: ISubListingRowRepository
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId } = event.payload;
        const query = { analysis: analysisId };

        await Promise.all([
            this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' }),
            this.listingRowRepository.deleteMany(query),
            this.subListingRowRepository.deleteMany(query)
        ]);
    }
};
