import TeamMember, { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { TeamMemberDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamMemberModel';

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