import TeamInvitation, { TeamInvitationProps, TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import teamInvitationMapper from '@modules/team/infrastructure/persistence/mongo/mappers/team-invitation/TeamInvitationMapper';
import TeamInvitationModel, { TeamInvitationDocument } from '@modules/team/infrastructure/persistence/mongo/models/team-invitation/TeamInvitationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';


@Singleton(TEAM_TOKENS.TeamInvitationRepository)
export default class TeamInvitationRepository
    extends MongooseBaseRepository<TeamInvitation, TeamInvitationProps, TeamInvitationDocument>{
    
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