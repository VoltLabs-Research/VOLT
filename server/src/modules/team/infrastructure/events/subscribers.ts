import type { SubscriberManifest } from '@shared/infrastructure/events/registerSubscribers';
import TeamDeletedEventHandler from '@modules/team/application/events/TeamDeletedEventHandler';
import UserDeletedEventHandler from '@modules/team/application/events/UserDeletedEventHandler';
import UserCreatedEventHandler from '@modules/team/application/events/UserCreatedEventHandler';
import TeamMemberLeaveEventHandler from '@modules/team/application/events/TeamMemberLeaveEventHandler';
import CatalogFolderTeamCleanupHandler from '@shared/application/catalog/CatalogFolderTeamCleanupHandler';

export const teamSubscriberManifest: SubscriberManifest = {
    'team-member.left': TeamMemberLeaveEventHandler,
    'team.deleted': [
        TeamDeletedEventHandler,
        CatalogFolderTeamCleanupHandler
    ],
    'user.deleted': UserDeletedEventHandler,
    'user.created': UserCreatedEventHandler
};
