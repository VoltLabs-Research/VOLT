import { container } from 'tsyringe';
import { IEventBus } from '@shared/application/events/IEventBus';
import { UserDeletedEventHandler } from '@modules/api-tracker/application/events/UserDeletedEventHandler';
import logger from '@shared/infrastructure/logger';

import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

export const registerApiTrackerSubscribers = async (): Promise<void> => {
    logger.info('@api-tracker: Registering event subscribers...');

    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    const userDeletedHandler = container.resolve(UserDeletedEventHandler);

    await eventBus.subscribe('user:deleted', userDeletedHandler);

    logger.info('@api-tracker: Event subscribers registered successfully');
};
