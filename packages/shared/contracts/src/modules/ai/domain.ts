import type { BaseEntity } from '../../shared/base';

export enum AIProvider{
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
}

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

export enum AIMessageRole{
    User = 'user',
    Assistant = 'assistant'
}

export interface AIModelChoice{
    provider: AIProvider;
    model: string;
}

export interface AIConversation extends BaseEntity{
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt: string | null;
    isArchived: boolean;
    provider: AIProvider | null;
    model: string | null;
}

export interface AIConversationCompacted{
    folded: number;
    kept: number;
}
