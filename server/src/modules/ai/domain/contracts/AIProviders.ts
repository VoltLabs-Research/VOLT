export enum AIProvider {
    OpenAI = 'openai',
    Anthropic = 'anthropic',
    Google = 'google',
    Groq = 'groq',
    XAI = 'xai',
    Mistral = 'mistral',
    Cohere = 'cohere',
    DeepSeek = 'deepseek',
    DeepInfra = 'deepinfra',
    Cerebras = 'cerebras',
    TogetherAI = 'togetherai',
    Fireworks = 'fireworks',
    Ollama = 'ollama'
};

export const AI_PROVIDERS = [
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

export const AI_PROVIDER_NAMES: Record<AIProvider, string> = {
    [AIProvider.OpenAI]: 'OpenAI',
    [AIProvider.Anthropic]: 'Anthropic',
    [AIProvider.Google]: 'Google',
    [AIProvider.Groq]: 'Groq',
    [AIProvider.XAI]: 'xAI',
    [AIProvider.Mistral]: 'Mistral',
    [AIProvider.Cohere]: 'Cohere',
    [AIProvider.DeepSeek]: 'DeepSeek',
    [AIProvider.DeepInfra]: 'DeepInfra',
    [AIProvider.Cerebras]: 'Cerebras',
    [AIProvider.TogetherAI]: 'Together AI',
    [AIProvider.Fireworks]: 'Fireworks AI',
    [AIProvider.Ollama]: 'Ollama'
};
