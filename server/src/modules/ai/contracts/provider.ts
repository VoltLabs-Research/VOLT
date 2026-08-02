import type { LanguageModel } from 'ai';
import type { AIProvider } from '@shared/contracts/types/AIProviders';

export interface ResolvedModel{
    model: LanguageModel;
    provider: AIProvider;
    modelName: string;
}
