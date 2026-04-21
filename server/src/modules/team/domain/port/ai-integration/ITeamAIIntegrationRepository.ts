import TeamAIIntegration, { TeamAIIntegrationProps, TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface ITeamAIIntegrationRepository extends IBaseRepository<TeamAIIntegration, TeamAIIntegrationProps> {
    findByTeamAndProviderWithSecret(teamId: string, provider: TeamAIProvider): Promise<TeamAIIntegration | null>;
    deleteByTeamAndProvider(teamId: string, provider: TeamAIProvider): Promise<boolean>;
    listByTeamId(teamId: string): Promise<TeamAIIntegration[]>;
    listEnabledByTeamIdWithSecrets(teamId: string): Promise<TeamAIIntegration[]>;
};
