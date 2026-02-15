import { TeamDocument } from '@modules/team/infrastructure/persistence/mongo/models/TeamModel';
import Team, { TeamProps } from '@modules/team/domain/entities/Team';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class TeamMapper extends BaseMapper<Team, TeamProps, TeamDocument>{
    constructor(){
        super(Team, [
            'owner',
            'admins',
            'members',
            'invitations',
            'containers',
            'trajectories',
            'chats',
            'plugins'
        ]);
    }
};

export default new TeamMapper();