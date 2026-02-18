import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/chat/application/events/TeamDeletedEventHandler';
import ChatDeletedEventHandler from '@modules/chat/application/events/ChatDeletedEventHandler';

export const registerChatSubscribers = (): Promise<void> =>
    registerSubscribers({
        'team.deleted': TeamDeletedEventHandler,
        'chat.deleted': ChatDeletedEventHandler
    });
