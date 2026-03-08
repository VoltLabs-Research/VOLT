import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import type { TeamAIIntegration } from '../entities/team-ai-integration';

export interface CreateTeamAIIntegrationParams {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
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
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
};

export type CreateTeamAIIntegrationOutputDTO = CreateTeamAIIntegrationResponse;
