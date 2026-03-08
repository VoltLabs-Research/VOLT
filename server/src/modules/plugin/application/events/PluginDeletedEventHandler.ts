import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IListingRowRepository } from '@modules/plugin/domain/port/listing-row/IListingRowRepository';
import { ISubListingRowRepository } from '@modules/plugin/domain/port/listing-row/ISubListingRowRepository';
import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';

import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';

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
};
