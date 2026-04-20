import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/team-cluster/application/events/TeamDeletedEventHandler';

export const teamClusterSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler
};
