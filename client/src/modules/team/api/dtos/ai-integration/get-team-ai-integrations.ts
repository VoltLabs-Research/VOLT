import type { TeamAIIntegration } from '../../entities/ai-integration';

export interface ListTeamAIIntegrationsResponse {
    teamId: string;
    integrations: TeamAIIntegration[];
};

export interface GetTeamAIIntegrationsInputDTO {
    teamId: string;
};

export type GetTeamAIIntegrationsOutputDTO = ListTeamAIIntegrationsResponse;
