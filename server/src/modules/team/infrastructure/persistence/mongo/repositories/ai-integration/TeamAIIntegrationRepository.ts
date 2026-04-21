import TeamAIIntegration, { TeamAIIntegrationProps, TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import { ITeamAIIntegrationRepository } from '@modules/team/domain/port/ai-integration/ITeamAIIntegrationRepository';
import teamAIIntegrationMapper from '@modules/team/infrastructure/persistence/mongo/mappers/ai-integration/TeamAIIntegrationMapper';
import TeamAIIntegrationModel, { TeamAIIntegrationDocument } from '@modules/team/infrastructure/persistence/mongo/models/ai-integration/TeamAIIntegrationModel';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

@injectable()
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
