import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TeamDeletedEventHandler from '@modules/chat/application/events/TeamDeletedEventHandler';
import ChatDeletedEventHandler from '@modules/chat/application/events/ChatDeletedEventHandler';

export const registerChatSubscribers = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    const teamDeletedHandler = container.resolve(TeamDeletedEventHandler);
    const chatDeletedHandler = container.resolve(ChatDeletedEventHandler);

    await eventBus.subscribe('team.deleted', teamDeletedHandler);
    await eventBus.subscribe('chat.deleted', chatDeletedHandler);
};
