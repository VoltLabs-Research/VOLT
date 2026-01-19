import TeamInvitation, { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';
import { TeamInvitationDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamInvitationModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class TeamInvitationMapper extends BaseMapper<TeamInvitation, TeamInvitationProps, TeamInvitationDocument> {
    constructor() {
        super(TeamInvitation, [
            'team',
            'invitedBy',
            'invitedUser',
            'role'
        ]);
    }
}

export default new TeamInvitationMapper();