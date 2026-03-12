import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import { ProviderScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamAIIntegrationMutationPayloadDTO } from '@modules/team/application/dtos/ai-integration/CreateTeamAIIntegrationDTO';

export interface UpdateTeamAIIntegrationInputDTO extends ProviderScopedInputDTO, TeamAIIntegrationMutationPayloadDTO {};

export interface UpdateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
};
