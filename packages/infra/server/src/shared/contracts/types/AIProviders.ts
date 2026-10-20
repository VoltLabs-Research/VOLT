import { AIProvider, AI_PROVIDERS } from '@volt/contracts/modules/ai/domain';

export const AI_PROVIDER_NAMES: Record<AIProvider, string> = {
    [AIProvider.OpenAI]: 'OpenAI',
    [AIProvider.Anthropic]: 'Anthropic',
    [AIProvider.Google]: 'Google',
    [AIProvider.Groq]: 'Groq',
    [AIProvider.XAI]: 'xAI (Grok)',
    [AIProvider.Mistral]: 'Mistral',
    [AIProvider.Cohere]: 'Cohere',
    [AIProvider.DeepSeek]: 'DeepSeek',
    [AIProvider.DeepInfra]: 'DeepInfra',
    [AIProvider.Cerebras]: 'Cerebras',
    [AIProvider.TogetherAI]: 'Together AI',
    [AIProvider.Fireworks]: 'Fireworks AI',
    [AIProvider.Ollama]: 'Ollama'
};

export const AI_PROVIDER_DESCRIPTIONS: Record<AIProvider, string> = {
    [AIProvider.OpenAI]: 'GPT models for chat and reasoning.',
    [AIProvider.Anthropic]: 'Claude models for long context assistants.',
    [AIProvider.Google]: 'Gemini models for multimodal workflows.',
    [AIProvider.Groq]: 'Low latency hosted open models.',
    [AIProvider.XAI]: 'Grok models for reasoning and tool use.',
    [AIProvider.Mistral]: 'European open-weight and proprietary models.',
    [AIProvider.Cohere]: 'Enterprise RAG and command models.',
    [AIProvider.DeepSeek]: 'Competitive open-source reasoning models.',
    [AIProvider.DeepInfra]: 'Hosted open-source model inference.',
    [AIProvider.Cerebras]: 'Ultra-fast wafer-scale inference.',
    [AIProvider.TogetherAI]: 'Fast open-source model hosting.',
    [AIProvider.Fireworks]: 'Optimized open-source model serving.',
    [AIProvider.Ollama]: 'Self-hosted local models through Ollama.'
};
