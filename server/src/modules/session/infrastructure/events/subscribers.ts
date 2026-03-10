import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import UserDeletedEventHandler from '@modules/session/application/events/UserDeletedEventHandler';

export const sessionSubscriberManifest: SubscriberManifest = {
    'user.deleted': UserDeletedEventHandler
};
