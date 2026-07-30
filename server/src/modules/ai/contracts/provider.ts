import type { LanguageModel } from 'ai';
import type { AIProvider } from '@shared/contracts/types/AIProviders';

export interface ProviderCredentials{
    apiKey: string;
    baseUrl?: string;
}

export interface ResolvedModel{
    model: LanguageModel;
    provider: AIProvider;
    modelName: string;
}
