import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { MarkTrajectoryQueuedHandler } from '@modules/trajectory/application/events/MarkTrajectoryQueuedHandler';
import TeamDeletedEventHandler from '@modules/trajectory/application/events/TeamDeletedEventHandler';
import SessionCompletedEventHandler from '@modules/trajectory/application/events/SessionCompletedEventHandler';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';

export const registerTrajectorySubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const markQueuedHandler = container.resolve(MarkTrajectoryQueuedHandler);
    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);

    await eventBus.subscribe('PluginExecutionRequest', markQueuedHandler);
    await eventBus.subscribe('team.deleted', teamDeletedHandler);

    // Register session completed handler
    const sessionCompletedHandler = container.resolve(SessionCompletedEventHandler);
    await eventBus.subscribe('session.completed', sessionCompletedHandler);

    // Register job status handler for trajectory updates
    const jobStatusHandler = container.resolve(JobStatusChangedEventHandler);
    await eventBus.subscribe('job.status.changed', jobStatusHandler);
};