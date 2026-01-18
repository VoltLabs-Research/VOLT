import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/team/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/team/application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '@modules/team/application/events/UserCreatedEventHandler';
import TeamCreatedEventHandler from '@modules/team/application/events/TeamCreatedEventHandler';
import JobStatusChangedEventHandler from '@modules/team/application/events/JobStatusChangedEventHandler';

export const registerTeamSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const userDeletedHandler = container.resolve(UserDeletedEventHandler);
    const userCreatedHandler = container.resolve(UserCreatedEventHandler);
    const teamCreatedHandler = container.resolve(TeamCreatedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('team.created', teamCreatedHandler);
    await eventBus.subscribe('user.deleted', userDeletedHandler);
    await eventBus.subscribe('user.deleted', userDeletedHandler);
    await eventBus.subscribe('user.created', userCreatedHandler);

    const teamJobStatusHandler = container.resolve(JobStatusChangedEventHandler);
    await eventBus.subscribe('job.status.changed', teamJobStatusHandler);
};
