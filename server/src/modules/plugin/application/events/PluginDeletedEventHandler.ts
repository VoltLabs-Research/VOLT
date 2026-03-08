import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { IListingRowRepository } from '@modules/plugin/domain/port/IListingRowRepository';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/ISubListingRowRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';

@injectable()
export default class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private readonly listingRowRepository: IListingRowRepository,

        @inject(PLUGIN_TOKENS.SubListingRowRepository)
        private readonly subListingRowRepository: ISubListingRowRepository
    ){}

    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await Promise.all([
            this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' }),
            this.listingRowRepository.deleteMany(query),
            this.subListingRowRepository.deleteMany(query)
        ]);
    }
}
