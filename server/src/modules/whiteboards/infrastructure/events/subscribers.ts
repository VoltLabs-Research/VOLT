import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/whiteboards/application/events/TeamDeletedEventHandler';

export const whiteboardSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler
};
