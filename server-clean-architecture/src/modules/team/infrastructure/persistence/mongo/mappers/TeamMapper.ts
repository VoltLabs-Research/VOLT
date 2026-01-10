import { TeamDocument } from "../models/TeamModel";
import Team, { TeamProps } from '../../../../domain/entities/Team';
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";

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