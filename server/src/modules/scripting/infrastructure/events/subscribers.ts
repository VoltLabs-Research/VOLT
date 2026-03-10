import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/scripting/application/events/TeamDeletedEventHandler';
import TrajectoryDeletedEventHandler from '@modules/scripting/application/events/TrajectoryDeletedEventHandler';

export const scriptingSubscriberManifest: SubscriberManifest = {
    'team.deleted': TeamDeletedEventHandler,
    'trajectory.deleted': TrajectoryDeletedEventHandler
};
