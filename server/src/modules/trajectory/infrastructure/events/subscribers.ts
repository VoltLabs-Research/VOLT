import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import { MarkTrajectoryQueuedHandler } from '@modules/trajectory/application/events/MarkTrajectoryQueuedHandler';
import TeamDeletedEventHandler from '@modules/trajectory/application/events/TeamDeletedEventHandler';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';

export const trajectorySubscriberManifest: SubscriberManifest = {
    'PluginExecutionRequest': MarkTrajectoryQueuedHandler,
    'team.deleted': TeamDeletedEventHandler,
    'job.status.changed': JobStatusChangedEventHandler
};
