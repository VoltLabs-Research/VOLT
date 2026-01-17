import TeamRole, { TeamRoleProps } from "@/src/modules/team/domain/entities/TeamRole";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";
import TeamRoleModel, { TeamRoleDocument } from "../models/TeamRoleModel";
import { ITeamRoleRepository } from "@/src/modules/team/domain/ports/ITeamRoleRepository";
import teamRoleMapper from '../mappers/TeamRole';

import { Types } from "mongoose";

@injectable()
export default class TeamRoleRepository
    extends MongooseBaseRepository<TeamRole, TeamRoleProps, TeamRoleDocument>
    implements ITeamRoleRepository {

    constructor() {
        super(TeamRoleModel, teamRoleMapper);
    }

    override async findAll(options: any): Promise<any> {
        const { filter } = options;
        if (filter && filter.team && typeof filter.team === 'string') {
            filter.team = new Types.ObjectId(filter.team);
        }
        return super.findAll(options);
    }
}