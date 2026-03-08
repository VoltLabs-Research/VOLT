import { injectable, inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import type { IListingRowRepository } from '@modules/plugin/domain/port/IListingRowRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository
    ){}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        const query = { trajectory: trajectoryId };

        await Promise.all([
            this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' }),
            this.listingRowRepository.deleteMany(query)
        ]);
    }
}
