import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { inject } from 'tsyringe';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('plugin.deleted')
export default class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await this.sceneArtifactRepository.deleteMany({ ...query, sourceType: 'plugin-exposure' });
    }
}
