import { TeamAIIntegrationItemDTO } from '@modules/team/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import { ProviderScopedInputDTO } from '@modules/team/dtos/common';
import type { TeamAIIntegrationMutationPayloadDTO } from '@modules/team/dtos/ai-integration/CreateTeamAIIntegrationDTO';

export interface UpdateTeamAIIntegrationInputDTO extends ProviderScopedInputDTO, TeamAIIntegrationMutationPayloadDTO {};

export interface UpdateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
};
