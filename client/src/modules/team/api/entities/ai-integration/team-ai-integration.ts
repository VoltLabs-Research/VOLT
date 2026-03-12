import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';

export interface TeamAIIntegration extends BaseEntity {
    teamId: string;
    provider: AIProvider;
    providerName: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: TeamAIModelMetadata[];
    metadata?: Record<string, unknown>;
    hasApiKey: boolean;
    createdBy?: string;
};

export interface TeamAIModelMetadata {
    id: string;
    name: string;
};

export interface TeamAIProviderModelsCatalog {
    provider: AIProvider;
    providerName: string;
    defaultModel?: string;
    metadata?: Record<string, unknown>;
    models: TeamAIModelMetadata[];
};

export interface TeamAIModelListItem extends TeamAIModelMetadata {
    provider: AIProvider;
    providerName: string;
    isDefault: boolean;
};

export interface AIProviderCatalogItem {
    id: string;
    name: string;
    description: string;
};
