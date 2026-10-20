import type { LanguageModel } from 'ai';
import type { AIProvider } from '@volt/contracts/modules/ai/domain';

export interface ResolvedModel{
    model: LanguageModel;
    provider: AIProvider;
    modelName: string;
}
