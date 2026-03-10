import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/auth/application/events/TeamDeletedEventHandler';

export const authSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler
};
