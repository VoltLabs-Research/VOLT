import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import UserDeletedEventHandler from '@modules/notification/application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '@modules/notification/application/events/UserCreatedEventHandler';
import InvitationSentEventHandler from '@modules/notification/application/events/InvitationSentEventHandler';

export const registerNotificationSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'invitation.sent': InvitationSentEventHandler,
        'user.deleted': UserDeletedEventHandler,
        'user.created': UserCreatedEventHandler
    });
};
