import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';

@injectable()
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent>{
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository
    ){}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId } = event.payload;
        const query = { analysis: analysisId };

        await Promise.all([
            this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' }),
            this.listingRowRepository.deleteMany(query)
        ]);
    }
}
