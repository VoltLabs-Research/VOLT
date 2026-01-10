import TeamRole, { TeamRoleProps } from "@/src/modules/team/domain/entities/TeamRole";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";
import { TeamRoleDocument } from "../models/TeamRoleModel";

class TeamRoleMapper extends BaseMapper<TeamRole, TeamRoleProps, TeamRoleDocument>{
    constructor(){
        super(TeamRole, [
            'team'
        ]);
    }
};

export default new TeamRoleMapper();