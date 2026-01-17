import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import TeamDeletedEventHandler from '../../application/events/TeamDeletedEventHandler';
import LogPluginExecutionRequestHandler from '../../application/events/LogPluginExecutionRequestHandler';

export const registerDailyActivitySubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const logPluginExecutionHandler = container.resolve(LogPluginExecutionRequestHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('PluginExecutionRequest', logPluginExecutionHandler);
};
