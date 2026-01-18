import { container } from 'tsyringe';
import { IEventBus } from '@shared/application/events/IEventBus';
import { TeamDeletedEventHandler } from '@modules/container/application/events/TeamDeletedEventHandler';
import logger from '@shared/infrastructure/logger';

import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

export const registerContainerSubscribers = async (): Promise<void> => {
    logger.info('@container: Registering event subscribers...');

    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);

    await eventBus.subscribe('team:deleted', teamDeletedHandler);

    logger.info('@container: Event subscribers registered successfully');
};
