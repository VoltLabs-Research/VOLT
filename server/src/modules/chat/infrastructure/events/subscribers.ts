import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import { deleteManyOnTeamDeletedHandler } from '@shared/application/events/cascadeDeleteHandlerFactories';
import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import ChatDeletedEventHandler from '@modules/chat/application/events/ChatDeletedEventHandler';
import UserDeletedEventHandler from '@modules/chat/application/events/UserDeletedEventHandler';

const TeamDeletedEventHandler = deleteManyOnTeamDeletedHandler(CHAT_TOKENS.ChatRepository);

export const chatSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'chat.deleted': ChatDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler
};
