import TeamMember, { TeamMemberProps } from '@modules/team/entities/team-member/TeamMember';
import { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import teamMemberMapper from '@modules/team/mappers/team-member/TeamMemberMapper';
import TeamMemberModel, { TeamMemberDocument } from '@modules/team/models/team-member/TeamMemberModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';


@Singleton(TEAM_TOKENS.TeamMemberRepository)
export default class TeamMemberRepository
    extends MongooseBaseRepository<TeamMember, TeamMemberProps, TeamMemberDocument>
    implements ITeamMemberRepository {

    constructor() {
        super(TeamMemberModel, teamMemberMapper);
    }

    async findByUserId(userId: string): Promise<TeamMember[]> {
        const docs = await this.model.find({ user: userId });
        return docs.map((doc) => this.mapper.toDomain(doc));
    }

    async deleteByUserId(userId: string): Promise<void> {
        await this.model.deleteMany({ user: userId });
    }

    async getTeamIdsByUserId(userId: string): Promise<string[]> {
        const docs = await this.model.find({ user: userId }).select('team');
        return docs.map(doc => doc.team.toString());
    }
};
