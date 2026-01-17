import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import UserDeletedEventHandler from '../../application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '../../application/events/UserCreatedEventHandler';

export const registerNotificationSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const userDeletedHandler = container.resolve(UserDeletedEventHandler);
    const userCreatedHandler = container.resolve(UserCreatedEventHandler);

    await eventBus.subscribe('user.deleted', userDeletedHandler);
    await eventBus.subscribe('user.created', userCreatedHandler);
};
