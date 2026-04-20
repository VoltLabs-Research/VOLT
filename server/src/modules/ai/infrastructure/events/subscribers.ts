import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/ai/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/ai/application/events/UserDeletedEventHandler';

export const aiSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler
};
