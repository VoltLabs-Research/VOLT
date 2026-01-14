import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import { MarkTrajectoryQueuedHandler } from '../../application/events/MarkTrajectoryQueuedHandler';

export const registerTrajectorySubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const handler = container.resolve(MarkTrajectoryQueuedHandler);

    await eventBus.subscribe('PluginExecutionRequest', handler);
};