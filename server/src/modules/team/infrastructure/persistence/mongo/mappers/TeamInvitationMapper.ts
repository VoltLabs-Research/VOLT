import TeamInvitation, { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';
import { TeamInvitationDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamInvitationModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<TeamInvitation, TeamInvitationProps, TeamInvitationDocument>(TeamInvitation, [
    'team',
    'invitedBy',
    'invitedUser',
    'role'
]);
