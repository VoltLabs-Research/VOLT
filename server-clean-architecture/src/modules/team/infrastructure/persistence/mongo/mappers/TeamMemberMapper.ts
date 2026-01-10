import TeamMember, { TeamMemberProps } from "@/src/modules/team/domain/entities/TeamMember";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";
import { TeamMemberDocument } from "../models/TeamMemberModel";

class TeamMemberMapper extends BaseMapper<TeamMember, TeamMemberProps, TeamMemberDocument>{
    constructor(){
        super(TeamMember, [
            'team',
            'user',
            'role'
        ]);
    }
};

export default new TeamMemberMapper();