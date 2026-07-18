import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type TeamAIIntegration from '@modules/team/entities/ai-integration/TeamAIIntegration';
import type { TeamAIIntegrationProps, TeamAIProvider } from '@modules/team/entities/ai-integration/TeamAIIntegration';

export interface ITeamAIIntegrationRepository extends IBaseRepository<TeamAIIntegration, TeamAIIntegrationProps> {
    findByTeamAndProviderWithSecret(teamId: string, provider: TeamAIProvider): Promise<TeamAIIntegration | null>;
    deleteByTeamAndProvider(teamId: string, provider: TeamAIProvider): Promise<boolean>;
    listByTeamId(teamId: string): Promise<TeamAIIntegration[]>;
    listEnabledByTeamIdWithSecrets(teamId: string): Promise<TeamAIIntegration[]>;
}
