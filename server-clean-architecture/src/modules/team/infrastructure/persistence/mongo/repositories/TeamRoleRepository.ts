import TeamRole, { TeamRoleProps } from "@/src/modules/team/domain/entities/TeamRole";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";
import TeamRoleModel, { TeamRoleDocument } from "../models/TeamRoleModel";
import { ITeamRoleRepository } from "@/src/modules/team/domain/ports/ITeamRoleRepository";
import teamRoleMapper from '../mappers/TeamRole';

@injectable()
export default class TeamRoleRepository
    extends MongooseBaseRepository<TeamRole, TeamRoleProps, TeamRoleDocument>
    implements ITeamRoleRepository{

    constructor(){
        super(TeamRoleModel, teamRoleMapper);
    }
}