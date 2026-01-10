import TeamInvitation, { TeamInvitationProps } from "@/src/modules/team/domain/entities/TeamInvitation";
import { TeamInvitationDocument } from "../models/TeamInvitationModel";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

class TeamInvitationMapper extends BaseMapper<TeamInvitation, TeamInvitationProps, TeamInvitationDocument>{
    constructor(){
        super(TeamInvitation, [
            'team',
            'invitedBy',
            'invitedUser'
        ]);
    }
}

export default new TeamInvitationMapper();