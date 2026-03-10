import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/ssh/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/ssh/application/events/UserDeletedEventHandler';

export const sshSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler
};
