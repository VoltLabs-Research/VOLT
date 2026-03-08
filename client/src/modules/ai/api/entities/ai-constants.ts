export const AI_PROVIDERS = [
    'openai',
    'anthropic',
    'google',
    'groq',
    'xai',
    'mistral',
    'cohere',
    'deepseek',
    'deepinfra',
    'cerebras',
    'togetherai',
    'fireworks',
    'ollama'
] as const;

export type AIProvider = typeof AI_PROVIDERS[number];

export const AI_PROVIDER_CATALOG: Array<{ id: AIProvider; name: string; description: string }> = [
    { id: 'openai', name: 'OpenAI', description: 'GPT models for chat and reasoning.' },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude models for long context assistants.' },
    { id: 'google', name: 'Google', description: 'Gemini models for multimodal workflows.' },
    { id: 'groq', name: 'Groq', description: 'Low latency hosted open models.' },
    { id: 'xai', name: 'xAI (Grok)', description: 'Grok models for reasoning and tool use.' },
    { id: 'mistral', name: 'Mistral', description: 'European open-weight and proprietary models.' },
    { id: 'cohere', name: 'Cohere', description: 'Enterprise RAG and command models.' },
    { id: 'deepseek', name: 'DeepSeek', description: 'Competitive open-source reasoning models.' },
    { id: 'deepinfra', name: 'DeepInfra', description: 'Hosted open-source model inference.' },
    { id: 'cerebras', name: 'Cerebras', description: 'Ultra-fast wafer-scale inference.' },
    { id: 'togetherai', name: 'Together AI', description: 'Fast open-source model hosting.' },
    { id: 'fireworks', name: 'Fireworks AI', description: 'Optimized open-source model serving.' },
    { id: 'ollama', name: 'Ollama', description: 'Self-hosted local models through Ollama.' }
];
