import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/daily-activity/application/events/TeamDeletedEventHandler';
import LogPluginExecutionRequestHandler from '@modules/daily-activity/application/events/LogPluginExecutionRequestHandler';
import TrajectoryCreatedEventHandler from '@modules/daily-activity/application/events/TrajectoryCreatedEventHandler';

export const registerDailyActivitySubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const logPluginExecutionHandler = container.resolve(LogPluginExecutionRequestHandler);
    const trajectoryCreatedHandler = container.resolve(TrajectoryCreatedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('PluginExecutionRequest', logPluginExecutionHandler);
    await eventBus.subscribe('trajectory.created', trajectoryCreatedHandler);
};
