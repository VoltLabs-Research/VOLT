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

export const AI_PROVIDER_NAMES: Record<AIProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    groq: 'Groq',
    xai: 'xAI',
    mistral: 'Mistral',
    cohere: 'Cohere',
    deepseek: 'DeepSeek',
    deepinfra: 'DeepInfra',
    cerebras: 'Cerebras',
    togetherai: 'Together AI',
    fireworks: 'Fireworks AI',
    ollama: 'Ollama'
};
