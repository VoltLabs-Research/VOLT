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

export enum AIMessageArtifactKind{
    Table = 'table',
    Chart = 'chart',
    Image = 'image',
    Text = 'text',
    Unknown = 'unknown'
}

export interface AIMessageArtifact{
    id: string;
    messageId: string;
    kind: AIMessageArtifactKind;
    title: string;
    summary?: string;
    payload: unknown;
    toolName?: string | null;
}

export interface AIConversationMessageArtifacts{
    items?: AIMessageArtifact[];
    [key: string]: unknown;
}

export interface AIConversation extends BaseEntity{
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: string | null;
    lastProvider?: AIProvider | string | null;
    lastModel?: string | null;
    isArchived: boolean;
}

export interface AIMessage extends BaseEntity{
    conversationId: string;
    role: AIMessageRole;
    parts: unknown[];
    content: string;
    artifacts?: AIConversationMessageArtifacts | null;
    modelInfo?: Record<string, unknown> | null;
    tokenUsage?: Record<string, unknown> | null;
}

export interface CreateAIConversationResponse{
    conversation: AIConversation;
    userMessage?: AIMessage;
}
