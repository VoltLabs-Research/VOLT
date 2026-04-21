import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import { deleteManyOnUserDeletedHandler } from '@shared/application/events/cascadeDeleteHandlerFactories';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import UserCreatedEventHandler from '@modules/notification/application/events/UserCreatedEventHandler';
import InvitationSentEventHandler from '@modules/notification/application/events/InvitationSentEventHandler';

const UserDeletedEventHandler = deleteManyOnUserDeletedHandler(
    NOTIFICATION_TOKENS.NotificationRepository,
    { filterField: 'recipient' }
);

export const notificationSubscriberManifest: SubscriberManifest = {
    'invitation.sent': InvitationSentEventHandler,
    'user.deleted': UserDeletedEventHandler,
    'user.created': UserCreatedEventHandler
};
