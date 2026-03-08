import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/team/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/team/application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '@modules/team/application/events/UserCreatedEventHandler';
import TeamCreatedEventHandler from '@modules/team/application/events/TeamCreatedEventHandler';
import JobStatusChangedEventHandler from '@modules/team/application/events/JobStatusChangedEventHandler';
import TeamMemberLeaveEventHandler from '@modules/team/application/events/TeamMemberLeaveEventHandler';

export const registerTeamSubscribers = async (): Promise<void> => {
    await registerSubscribers({
        'team-member.left': TeamMemberLeaveEventHandler,
        'team.deleted': TeamDeletedEventHandler,
        'team.created': TeamCreatedEventHandler,
        'user.deleted': UserDeletedEventHandler,
        'user.created': UserCreatedEventHandler,
        'job.status.changed': JobStatusChangedEventHandler
    });
};
