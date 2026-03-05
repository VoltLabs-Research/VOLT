import { type AIProvider } from '@/modules/ai/domain/constants/AIProviders';

export type TeamAIProvider = AIProvider;

export interface TeamAIIntegration {
    _id: string;
    teamId: string;
    provider: TeamAIProvider;
    providerName: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
    hasApiKey: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TeamAIModelMetadata {
    id: string;
    name: string;
    description?: string;
    contextWindow?: number;
    inputModalities: string[];
    outputModalities: string[];
}

export interface TeamAIProviderModelsCatalog {
    provider: TeamAIProvider;
    providerName: string;
    defaultModel?: string;
    metadata?: Record<string, unknown>;
    models: TeamAIModelMetadata[];
}

export interface TeamAIModelListItem extends TeamAIModelMetadata {
    provider: TeamAIProvider;
    providerName: string;
    isDefault: boolean;
}
