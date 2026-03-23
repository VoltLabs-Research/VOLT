import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import ProjectTeamJobStatusChangedEventHandler from '@modules/jobs/application/events/ProjectTeamJobStatusChangedEventHandler';

export const jobsSubscriberManifest: SubscriberManifest = {
    'job.status.changed': ProjectTeamJobStatusChangedEventHandler
};
