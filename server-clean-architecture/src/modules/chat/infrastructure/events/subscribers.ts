import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import TeamDeletedEventHandler from '../../application/events/TeamDeletedEventHandler';
import ChatDeletedEventHandler from '../../application/events/ChatDeletedEventHandler';

export const registerChatSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const chatDeletedHandler = container.resolve(ChatDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('chat.deleted', chatDeletedHandler);
};
