import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/plugin/application/events/TeamDeletedEventHandler';
import TeamCreatedEventHandler from '@modules/plugin/application/events/TeamCreatedEventHandler';
import PluginDeletedEventHandler from '@modules/plugin/application/events/PluginDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/plugin/application/events/TrajectoryDeletedEventHandler';

export const registerPluginSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const teamCreatedHandler = container.resolve(TeamCreatedEventHandler);
    const pluginDeletedHandler = container.resolve(PluginDeletedEventHandler);
    const trajectoryDeletedHandler = container.resolve(TrajectoryDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('team.created', teamCreatedHandler);
    await eventBus.subscribe('plugin.deleted', pluginDeletedHandler);
    await eventBus.subscribe('trajectory.deleted', trajectoryDeletedHandler);
};
