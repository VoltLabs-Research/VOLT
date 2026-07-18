import TeamAIIntegration, { TeamAIIntegrationProps, TeamAIProvider } from '@modules/team/entities/ai-integration/TeamAIIntegration';
import type { ITeamAIIntegrationRepository } from '@modules/team/ports/ai-integration/ITeamAIIntegrationRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import teamAIIntegrationMapper from '@modules/team/mappers/ai-integration/TeamAIIntegrationMapper';
import TeamAIIntegrationModel, { TeamAIIntegrationDocument } from '@modules/team/models/ai-integration/TeamAIIntegrationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';


@Singleton(TEAM_TOKENS.TeamAIIntegrationRepository)
export default class TeamAIIntegrationRepository
    extends MongooseBaseRepository<TeamAIIntegration, TeamAIIntegrationProps, TeamAIIntegrationDocument>
    implements ITeamAIIntegrationRepository {

    constructor() {
        super(TeamAIIntegrationModel, teamAIIntegrationMapper);
    }

    async findByTeamAndProviderWithSecret(teamId: string, provider: TeamAIProvider): Promise<TeamAIIntegration | null> {
        const doc = await this.model.findOne({
            team: teamId,
            provider
        }).select('+encryptedApiKey').exec();

        return doc ? this.mapper.toDomain(doc) : null;
    }

    async deleteByTeamAndProvider(teamId: string, provider: TeamAIProvider): Promise<boolean> {
        const result = await this.model.deleteOne({ team: teamId, provider });
        return result.deletedCount > 0;
    }

    async listByTeamId(teamId: string): Promise<TeamAIIntegration[]> {
        const docs = await this.model.find({ team: teamId }).sort({ createdAt: -1 }).exec();
        return docs.map((doc) => this.mapper.toDomain(doc));
    }

    async listEnabledByTeamIdWithSecrets(teamId: string): Promise<TeamAIIntegration[]> {
        const docs = await this.model.find({
            team: teamId,
            isEnabled: true
        }).select('+encryptedApiKey').sort({ createdAt: -1 }).exec();

        return docs.map((doc) => this.mapper.toDomain(doc));
    }
};
