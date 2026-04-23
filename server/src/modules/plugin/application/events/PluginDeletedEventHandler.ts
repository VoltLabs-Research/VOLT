import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('plugin.deleted')
export default class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    constructor(
        
        private readonly sceneArtifactRepository: SceneArtifactRepository
    ){}

    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' });
    }
};
