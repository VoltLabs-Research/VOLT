import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/chat/application/events/TeamDeletedEventHandler';
import ChatDeletedEventHandler from '@modules/chat/application/events/ChatDeletedEventHandler';
import UserDeletedEventHandler from '@modules/chat/application/events/UserDeletedEventHandler';

export const chatSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'chat.deleted': ChatDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler
};
