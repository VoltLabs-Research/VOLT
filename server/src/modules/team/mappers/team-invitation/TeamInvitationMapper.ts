import TeamInvitation, { TeamInvitationProps } from '@modules/team/entities/team-invitation/TeamInvitation';
import { TeamInvitationDocument } from '@modules/team/models/team-invitation/TeamInvitationModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamInvitation, TeamInvitationProps, TeamInvitationDocument>(TeamInvitation, [
    'team',
    'invitedBy',
    'invitedUser',
    'role'
]);
