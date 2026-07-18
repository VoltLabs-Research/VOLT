import PluginDeletedEvent from '@modules/plugin/events/PluginDeletedEvent';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { IEventHandler } from '@shared/application/events/IEventHandler';

@Subscribe('plugin.deleted')
export default class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await SceneArtifactModel.deleteMany({ ...query, sourceType: 'plugin-exposure' }).exec();
    }
}
