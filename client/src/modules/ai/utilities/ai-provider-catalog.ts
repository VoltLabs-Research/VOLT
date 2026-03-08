import { AIProvider } from '@/modules/ai/api/entities/ai-provider';

export interface AIProviderCatalogItem {
    id: AIProvider;
    name: string;
    description: string;
};

export const AI_PROVIDERS: AIProvider[] = [
    AIProvider.OpenAI,
    AIProvider.Anthropic,
    AIProvider.Google,
    AIProvider.Groq,
    AIProvider.XAI,
    AIProvider.Mistral,
    AIProvider.Cohere,
    AIProvider.DeepSeek,
    AIProvider.DeepInfra,
    AIProvider.Cerebras,
    AIProvider.TogetherAI,
    AIProvider.Fireworks,
    AIProvider.Ollama
];

export const AI_PROVIDER_CATALOG: AIProviderCatalogItem[] = [
    {
        id: AIProvider.OpenAI,
        name: 'OpenAI',
        description: 'GPT models for chat and reasoning.'
    },
    {
        id: AIProvider.Anthropic,
        name: 'Anthropic',
        description: 'Claude models for long context assistants.'
    },
    {
        id: AIProvider.Google,
        name: 'Google',
        description: 'Gemini models for multimodal workflows.'
    },
    {
        id: AIProvider.Groq,
        name: 'Groq',
        description: 'Low latency hosted open models.'
    },
    {
        id: AIProvider.XAI,
        name: 'xAI (Grok)',
        description: 'Grok models for reasoning and tool use.'
    },
    {
        id: AIProvider.Mistral,
        name: 'Mistral',
        description: 'European open-weight and proprietary models.'
    },
    {
        id: AIProvider.Cohere,
        name: 'Cohere',
        description: 'Enterprise RAG and command models.'
    },
    {
        id: AIProvider.DeepSeek,
        name: 'DeepSeek',
        description: 'Competitive open-source reasoning models.'
    },
    {
        id: AIProvider.DeepInfra,
        name: 'DeepInfra',
        description: 'Hosted open-source model inference.'
    },
    {
        id: AIProvider.Cerebras,
        name: 'Cerebras',
        description: 'Ultra-fast wafer-scale inference.'
    },
    {
        id: AIProvider.TogetherAI,
        name: 'Together AI',
        description: 'Fast open-source model hosting.'
    },
    {
        id: AIProvider.Fireworks,
        name: 'Fireworks AI',
        description: 'Optimized open-source model serving.'
    },
    {
        id: AIProvider.Ollama,
        name: 'Ollama',
        description: 'Self-hosted local models through Ollama.'
    }
];
