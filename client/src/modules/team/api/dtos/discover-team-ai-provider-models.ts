import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';

export interface DiscoverTeamAIProviderModelsInputDTO {
    teamId: string;
    provider: AIProvider;
    apiKey?: string;
    metadata?: Record<string, unknown>;
};

export interface DiscoverTeamAIProviderModelsOutputDTO {
    teamId: string;
    provider: AIProvider;
    providerName: string;
    defaultModel: string | null;
    metadata?: Record<string, unknown>;
    models: Array<{
        id: string;
        name: string;
        description?: string;
    }>;
};
