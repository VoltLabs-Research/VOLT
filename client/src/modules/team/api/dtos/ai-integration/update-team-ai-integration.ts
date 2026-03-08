import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { TeamAIIntegration } from '../../entities/ai-integration';

export interface UpdateTeamAIIntegrationParams {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
};

export interface UpdateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
};

export interface UpdateTeamAIIntegrationInputDTO {
    teamId: string;
    provider: AIProvider;
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
};

export type UpdateTeamAIIntegrationOutputDTO = UpdateTeamAIIntegrationResponse;
