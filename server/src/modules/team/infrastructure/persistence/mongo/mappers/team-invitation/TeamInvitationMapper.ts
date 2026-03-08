import TeamInvitation, { TeamInvitationProps } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { TeamInvitationDocument } from '@modules/team/infrastructure/persistence/mongo/models/team-invitation/TeamInvitationModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamInvitation, TeamInvitationProps, TeamInvitationDocument>(TeamInvitation, [
    'team',
    'invitedBy',
    'invitedUser',
    'role'
]);
