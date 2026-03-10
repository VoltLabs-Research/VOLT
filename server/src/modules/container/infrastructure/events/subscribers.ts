import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/container/application/events/TeamDeletedEventHandler';

export const containerSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler
};
