import { createAnthropic } from '@ai-sdk/anthropic';
import { createCerebras } from '@ai-sdk/cerebras';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepInfra } from '@ai-sdk/deepinfra';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createFireworks } from '@ai-sdk/fireworks';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createXai } from '@ai-sdk/xai';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
import { ErrorCodes } from '@core/constants/error-codes';
import { AIProvider, AI_PROVIDERS } from '@shared/contracts/types/AIProviders';
import ApplicationError from '@shared/application/errors/ApplicationError';

export interface SdkOptions{
    apiKey?: string;
    baseURL?: string;
}

type SdkFactory = (options: SdkOptions) => (modelId: string) => LanguageModel;

const SDK_FACTORIES: Record<AIProvider, SdkFactory> = {
    [AIProvider.OpenAI]: createOpenAI,
    [AIProvider.Anthropic]: createAnthropic,
    [AIProvider.Google]: createGoogleGenerativeAI,
    [AIProvider.Groq]: createGroq,
    [AIProvider.XAI]: createXai,
    [AIProvider.Mistral]: createMistral,
    [AIProvider.Cohere]: createCohere,
    [AIProvider.DeepSeek]: createDeepSeek,
    [AIProvider.DeepInfra]: createDeepInfra,
    [AIProvider.Cerebras]: createCerebras,
    [AIProvider.TogetherAI]: createTogetherAI,
    [AIProvider.Fireworks]: createFireworks,
    [AIProvider.Ollama]: createOllama
};

/* The provider column is user-supplied configuration read back from the database, so
   a row can still name a provider this build no longer ships. */
export const buildLanguageModel = (provider: AIProvider, modelName: string, options: SdkOptions): LanguageModel => {
    const factory = SDK_FACTORIES[provider];
    if(!factory){
        throw ApplicationError.badRequest(
            ErrorCodes.AI_PROVIDER_UNAVAILABLE,
            `Provider "${provider}" is not supported. Available: ${AI_PROVIDERS.join(', ')}`
        );
    }

    return factory(options)(modelName);
};
