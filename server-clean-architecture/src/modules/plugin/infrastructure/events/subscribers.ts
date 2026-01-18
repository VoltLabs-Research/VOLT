import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/plugin/application/events/TeamDeletedEventHandler';
import PluginDeletedEventHandler from '@modules/plugin/application/events/PluginDeletedEventHandler';

export const registerPluginSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const pluginDeletedHandler = container.resolve(PluginDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('plugin.deleted', pluginDeletedHandler);
};
