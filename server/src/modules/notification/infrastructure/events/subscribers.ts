import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import UserDeletedEventHandler from '@modules/notification/application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '@modules/notification/application/events/UserCreatedEventHandler';
import InvitationSentEventHandler from '@modules/notification/application/events/InvitationSentEventHandler';

export const notificationSubscriberManifest: SubscriberManifest = {
    'invitation.sent': InvitationSentEventHandler,
    'user.deleted': UserDeletedEventHandler,
    'user.created': UserCreatedEventHandler
};
