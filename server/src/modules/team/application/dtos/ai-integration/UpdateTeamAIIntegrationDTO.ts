import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import { ProviderScopedInputDTO } from '@modules/team/application/dtos/common';
import type { EnabledModel } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

interface TeamAIIntegrationMutationPayloadDTO {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
};

export interface UpdateTeamAIIntegrationInputDTO extends ProviderScopedInputDTO, TeamAIIntegrationMutationPayloadDTO {};

export interface UpdateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
};
