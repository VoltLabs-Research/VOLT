import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import TeamDeletedEventHandler from '../../application/events/TeamDeletedEventHandler';

export const registerSSHSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
};
