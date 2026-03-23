import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/team/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/team/application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '@modules/team/application/events/UserCreatedEventHandler';
import TeamJobProjectedEventHandler from '@modules/team/application/events/TeamJobProjectedEventHandler';
import TeamMemberLeaveEventHandler from '@modules/team/application/events/TeamMemberLeaveEventHandler';

export const teamSubscriberManifest: SubscriberManifest = {
    'team-member.left': TeamMemberLeaveEventHandler,
    'team.deleted': TeamDeletedEventHandler,
    'user.deleted': UserDeletedEventHandler,
    'user.created': UserCreatedEventHandler,
    'job.team.projected': TeamJobProjectedEventHandler
};
