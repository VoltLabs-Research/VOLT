import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import { ProviderScopedInputDTO } from '@modules/team/application/dtos/common';

interface TeamAIIntegrationMutationPayloadDTO {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
};

export interface UpdateTeamAIIntegrationInputDTO extends ProviderScopedInputDTO, TeamAIIntegrationMutationPayloadDTO {};

export interface UpdateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
};
