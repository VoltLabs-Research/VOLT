import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { TeamAIIntegration, TeamAIModelMetadata } from '../../entities/ai-integration/team-ai-integration';

export interface CreateTeamAIIntegrationParams {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: TeamAIModelMetadata[];
    metadata?: Record<string, unknown>;
};

export interface CreateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
};

export interface CreateTeamAIIntegrationInputDTO {
    teamId: string;
    provider: AIProvider;
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: TeamAIModelMetadata[];
    metadata?: Record<string, unknown>;
};
