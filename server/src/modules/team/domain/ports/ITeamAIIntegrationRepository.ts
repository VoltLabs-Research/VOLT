import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import TeamAIIntegration, { TeamAIIntegrationProps, TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface ITeamAIIntegrationRepository extends IBaseRepository<TeamAIIntegration, TeamAIIntegrationProps> {
    findByTeamAndProvider(teamId: string, provider: TeamAIProvider): Promise<TeamAIIntegration | null>;
    findByTeamAndProviderWithSecret(teamId: string, provider: TeamAIProvider): Promise<TeamAIIntegration | null>;
    deleteByTeamAndProvider(teamId: string, provider: TeamAIProvider): Promise<boolean>;
    listByTeamId(teamId: string): Promise<TeamAIIntegration[]>;
    listEnabledByTeamIdWithSecrets(teamId: string): Promise<TeamAIIntegration[]>;
}
