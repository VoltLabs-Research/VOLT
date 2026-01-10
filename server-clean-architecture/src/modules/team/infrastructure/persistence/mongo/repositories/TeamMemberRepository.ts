import { ITeamMemberRepository } from "@/src/modules/team/domain/ports/ITeamMemberRepository";
import TeamMember, { TeamMemberProps } from "@/src/modules/team/domain/entities/TeamMember";
import TeamMemberModel, { TeamMemberDocument } from "../models/TeamMemberModel";
import teamMemberMapper from '../mappers/TeamMemberMapper';
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";

@injectable()
export default class TeamMemberRepository
    extends MongooseBaseRepository<TeamMember, TeamMemberProps, TeamMemberDocument>
    implements ITeamMemberRepository{

    constructor(){
        super(TeamMemberModel, teamMemberMapper);
    }
};