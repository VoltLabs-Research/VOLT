import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { inject } from 'tsyringe';
import type { ISceneArtifactRepository } from '@shared/contracts/ports';
import PluginDeletedEvent from '@modules/plugin/events/PluginDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('plugin.deleted')
export default class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    constructor(
        @inject(COMPUTE_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' });
    }
}
