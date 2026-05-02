import type { AIConversationMessageParts } from '@modules/ai/domain/contracts/AIConversationMessage';

export enum AIMessageRole {
    User = 'user',
    Assistant = 'assistant'
}

export interface AIMessageToolCall {
    toolName: string;
    input: unknown;
}

export interface AIMessageToolResult {
    toolName: string;
    input: unknown;
    output: unknown;
}

/**
 * Represents a single message stored in the database.
 * 
 * Messages are persisted in a transport-agnostic conversation format.
 */
export interface AIMessageProps {
    conversationId: string;
    role: AIMessageRole;
    parts: AIConversationMessageParts;
    /** Plain-text extraction of the message for search/display fallback. */
    content: string;
    /** Metadata from the AI response (provider, model, finish reason, tool steps). */
    modelInfo: AIMessageModelInfo | null;
    /** Token usage stats for assistant messages. */
    tokenUsage: AIMessageTokenUsage | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface AIMessageModelInfo {
    provider: string;
    model: string;
    finishReason: string;
    steps: AIMessageToolStep[];
}

export interface AIMessageToolStep {
    stepNumber: number;
    toolCalls: AIMessageToolCall[];
    toolResults: AIMessageToolResult[];
}

export interface AIMessageTokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export default class AIMessage {
    constructor(
        public readonly _id: string,
        public readonly props: AIMessageProps
    ) {}
}
