import type { AIProvider } from '@modules/ai/domain/contracts/AIProviders';

export interface AIProviderCatalogModel {
    id: string;
    name: string;
    description?: string;
};

const createAIProviderCatalogModel = (
    id: string,
    name: string,
    description: string
): AIProviderCatalogModel => {
    return {
        id,
        name,
        description
    };
};

const AI_PROVIDER_MODELS: Record<AIProvider, AIProviderCatalogModel[]> = {
    openai: [
        createAIProviderCatalogModel('gpt-4.1', 'GPT-4.1', 'Balanced flagship model for general tasks.'),
        createAIProviderCatalogModel('gpt-4o', 'GPT-4o', 'Fast multimodal model for chat and tools.'),
        createAIProviderCatalogModel('gpt-4.1-mini', 'GPT-4.1 mini', 'Lower-cost model for lightweight tasks.')
    ],
    anthropic: [
        createAIProviderCatalogModel('claude-3-5-sonnet-latest', 'Claude 3.5 Sonnet', 'Strong reasoning and coding performance.'),
        createAIProviderCatalogModel('claude-3-5-haiku-latest', 'Claude 3.5 Haiku', 'Fast, low-latency model for assistants.'),
        createAIProviderCatalogModel('claude-3-opus-latest', 'Claude 3 Opus', 'High-quality model for complex work.')
    ],
    google: [
        createAIProviderCatalogModel('gemini-1.5-pro', 'Gemini 1.5 Pro', 'Advanced multimodal model with long context.'),
        createAIProviderCatalogModel('gemini-1.5-flash', 'Gemini 1.5 Flash', 'Fast model for responsive interactions.'),
        createAIProviderCatalogModel('gemini-2.0-flash-exp', 'Gemini 2.0 Flash', 'Experimental high-speed Gemini model.')
    ],
    groq: [
        createAIProviderCatalogModel('llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile', 'General-purpose model optimized for speed.'),
        createAIProviderCatalogModel('llama-3.1-8b-instant', 'Llama 3.1 8B Instant', 'Low-latency model for simple tasks.'),
        createAIProviderCatalogModel('mixtral-8x7b-32768', 'Mixtral 8x7B', 'Open-weight mixture-of-experts model.')
    ],
    xai: [
        createAIProviderCatalogModel('grok-2', 'Grok 2', 'General-purpose Grok reasoning model.'),
        createAIProviderCatalogModel('grok-2-vision', 'Grok 2 Vision', 'Vision-capable Grok model.'),
        createAIProviderCatalogModel('grok-beta', 'Grok Beta', 'Earlier Grok model with broad compatibility.')
    ],
    mistral: [
        createAIProviderCatalogModel('mistral-large-latest', 'Mistral Large', 'Flagship Mistral model for complex tasks.'),
        createAIProviderCatalogModel('mistral-small-latest', 'Mistral Small', 'Faster and cheaper general-purpose model.'),
        createAIProviderCatalogModel('open-mixtral-8x22b', 'Open Mixtral 8x22B', 'Open-weight model for capable inference.')
    ],
    cohere: [
        createAIProviderCatalogModel('command-r-plus', 'Command R+', 'High-quality model for enterprise assistants.'),
        createAIProviderCatalogModel('command-r', 'Command R', 'Balanced model for RAG and chat.'),
        createAIProviderCatalogModel('command', 'Command', 'Legacy command model for compatibility.')
    ],
    deepseek: [
        createAIProviderCatalogModel('deepseek-chat', 'DeepSeek Chat', 'General-purpose conversational model.'),
        createAIProviderCatalogModel('deepseek-reasoner', 'DeepSeek Reasoner', 'Reasoning-optimized model for harder tasks.')
    ],
    deepinfra: [
        createAIProviderCatalogModel('meta-llama/Meta-Llama-3.1-70B-Instruct', 'Llama 3.1 70B Instruct', 'Hosted open model through DeepInfra.'),
        createAIProviderCatalogModel('Qwen/Qwen2.5-72B-Instruct', 'Qwen 2.5 72B Instruct', 'Large instruction-tuned open model.'),
        createAIProviderCatalogModel('mistralai/Mixtral-8x7B-Instruct-v0.1', 'Mixtral 8x7B Instruct', 'Mixture-of-experts model for chat.')
    ],
    cerebras: [
        createAIProviderCatalogModel('llama-3.3-70b', 'Llama 3.3 70B', 'Fast large model on Cerebras infrastructure.'),
        createAIProviderCatalogModel('llama3.1-8b', 'Llama 3.1 8B', 'Smaller model for lower-latency requests.'),
        createAIProviderCatalogModel('qwen-2.5-72b-instruct', 'Qwen 2.5 72B Instruct', 'Large instruction model for coding and chat.')
    ],
    togetherai: [
        createAIProviderCatalogModel('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'Llama 3.1 70B Turbo', 'High-throughput open model hosted by Together AI.'),
        createAIProviderCatalogModel('Qwen/Qwen2.5-72B-Instruct-Turbo', 'Qwen 2.5 72B Turbo', 'Fast instruction model for production workloads.'),
        createAIProviderCatalogModel('mistralai/Mixtral-8x7B-Instruct-v0.1', 'Mixtral 8x7B Instruct', 'Open mixture-of-experts model.')
    ],
    fireworks: [
        createAIProviderCatalogModel('accounts/fireworks/models/llama-v3p1-70b-instruct', 'Llama v3.1 70B Instruct', 'Fireworks-hosted Llama instruct model.'),
        createAIProviderCatalogModel('accounts/fireworks/models/qwen2p5-72b-instruct', 'Qwen 2.5 72B Instruct', 'Large instruction model for chat and reasoning.'),
        createAIProviderCatalogModel('accounts/fireworks/models/mixtral-8x7b-instruct', 'Mixtral 8x7B Instruct', 'Open model optimized for inference throughput.')
    ],
    ollama: []
};

export const getAIProviderCatalogModels = (provider: AIProvider): AIProviderCatalogModel[] => {
    return AI_PROVIDER_MODELS[provider].map((model) => ({ ...model }));
};
