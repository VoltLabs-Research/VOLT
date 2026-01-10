import { ITeamInvitationRepository } from "@/src/modules/team/domain/ports/ITeamInvitationRepository";
import TeamInvitation, { TeamInvitationProps, TeamInvitationStatus } from '../../../../domain/entities/TeamInvitation';
import TeamInvitationModel, { TeamInvitationDocument } from "../models/TeamInvitationModel";
import teamInvitationMapper from "../mappers/TeamInvitationMapper";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import { injectable } from "tsyringe";

@injectable()
export default class TeamInvitationRepository
    extends MongooseBaseRepository<TeamInvitation, TeamInvitationProps, TeamInvitationDocument>
    implements ITeamInvitationRepository{
    
    constructor(){
        super(TeamInvitationModel, teamInvitationMapper);
    }

    async findByToken(token: string): Promise<TeamInvitation | null>{
        const doc = await this.model.findOne({ token });
        return doc ? this.mapper.toDomain(doc) : null;
    }

    async findPendingByTeam(teamId: string): Promise<TeamInvitation[]>{
        const docs = await this.model.find({ team: teamId, status: TeamInvitationStatus.Pending });
        return docs.map(this.mapper.toDomain);
    }

    async updateStatus(token: string, status: TeamInvitationStatus): Promise<void>{
        await this.model.findOneAndUpdate({ token }, { status }, { new: true });
    }
}