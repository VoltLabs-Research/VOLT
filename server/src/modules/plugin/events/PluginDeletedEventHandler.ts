import PluginDeletedEvent from '@modules/plugin/events/PluginDeletedEvent';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

import { IEventHandler } from '@shared/application/events/IEventHandler';

class PluginDeletedEventHandler implements IEventHandler<PluginDeletedEvent> {
    async handle(event: PluginDeletedEvent): Promise<void> {
        const { pluginId } = event.payload;
        const query = { plugin: pluginId };

        await SceneArtifactModel.deleteMany({ ...query, sourceType: 'plugin-exposure' }).exec();
    }
}

const pluginDeletedEventHandler = new PluginDeletedEventHandler();
subscribeHandler('plugin.deleted', pluginDeletedEventHandler);

export default pluginDeletedEventHandler;
