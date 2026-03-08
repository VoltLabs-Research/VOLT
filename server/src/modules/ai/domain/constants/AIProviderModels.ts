import { type AIProvider } from './AIProviders';

export interface AIProviderCatalogModel {
    id: string;
    name: string;
    description?: string;
}

const AI_PROVIDER_MODELS: Record<AIProvider, AIProviderCatalogModel[]> = {
    openai: [
        { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Balanced flagship model for general tasks.' },
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Fast multimodal model for chat and tools.' },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', description: 'Lower-cost model for lightweight tasks.' }
    ],
    anthropic: [
        { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', description: 'Strong reasoning and coding performance.' },
        { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', description: 'Fast, low-latency model for assistants.' },
        { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', description: 'High-quality model for complex work.' }
    ],
    google: [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced multimodal model with long context.' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast model for responsive interactions.' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: 'Experimental high-speed Gemini model.' }
    ],
    groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'General-purpose model optimized for speed.' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Low-latency model for simple tasks.' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Open-weight mixture-of-experts model.' }
    ],
    xai: [
        { id: 'grok-2', name: 'Grok 2', description: 'General-purpose Grok reasoning model.' },
        { id: 'grok-2-vision', name: 'Grok 2 Vision', description: 'Vision-capable Grok model.' },
        { id: 'grok-beta', name: 'Grok Beta', description: 'Earlier Grok model with broad compatibility.' }
    ],
    mistral: [
        { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Flagship Mistral model for complex tasks.' },
        { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Faster and cheaper general-purpose model.' },
        { id: 'open-mixtral-8x22b', name: 'Open Mixtral 8x22B', description: 'Open-weight model for capable inference.' }
    ],
    cohere: [
        { id: 'command-r-plus', name: 'Command R+', description: 'High-quality model for enterprise assistants.' },
        { id: 'command-r', name: 'Command R', description: 'Balanced model for RAG and chat.' },
        { id: 'command', name: 'Command', description: 'Legacy command model for compatibility.' }
    ],
    deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'General-purpose conversational model.' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: 'Reasoning-optimized model for harder tasks.' }
    ],
    deepinfra: [
        { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B Instruct', description: 'Hosted open model through DeepInfra.' },
        { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B Instruct', description: 'Large instruction-tuned open model.' },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', description: 'Mixture-of-experts model for chat.' }
    ],
    cerebras: [
        { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Fast large model on Cerebras infrastructure.' },
        { id: 'llama3.1-8b', name: 'Llama 3.1 8B', description: 'Smaller model for lower-latency requests.' },
        { id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', description: 'Large instruction model for coding and chat.' }
    ],
    togetherai: [
        { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Turbo', description: 'High-throughput open model hosted by Together AI.' },
        { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', description: 'Fast instruction model for production workloads.' },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B Instruct', description: 'Open mixture-of-experts model.' }
    ],
    fireworks: [
        { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', name: 'Llama v3.1 70B Instruct', description: 'Fireworks-hosted Llama instruct model.' },
        { id: 'accounts/fireworks/models/qwen2p5-72b-instruct', name: 'Qwen 2.5 72B Instruct', description: 'Large instruction model for chat and reasoning.' },
        { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', description: 'Open model optimized for inference throughput.' }
    ],
    ollama: []
};

export const getAIProviderCatalogModels = (provider: AIProvider): AIProviderCatalogModel[] => {
    return AI_PROVIDER_MODELS[provider].map((model) => ({ ...model }));
};
