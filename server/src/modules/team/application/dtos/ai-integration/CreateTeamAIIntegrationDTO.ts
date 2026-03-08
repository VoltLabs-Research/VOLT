import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import { ProviderScopedInputDTO, TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

interface TeamAIIntegrationMutationPayloadDTO {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
};

export interface CreateTeamAIIntegrationInputDTO extends TeamUserScopedInputDTO, ProviderScopedInputDTO, TeamAIIntegrationMutationPayloadDTO {};

export interface CreateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
};
