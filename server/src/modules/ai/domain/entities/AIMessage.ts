import type { UIMessage } from 'ai';

export type AIMessageRole = 'user' | 'assistant';

/**
 * Represents a single message stored in the database.
 * 
 * Messages are persisted in UIMessage-compatible format so they can be
 * directly fed back into the SDK without manual conversion. The SDK's
 * `convertToModelMessages()` handles the UIMessage -> ModelMessage
 * transformation reliably.
 * 
 * Note: We only store user and assistant roles. The SDK internally
 * produces tool-role ModelMessages from assistant tool-call parts,
 * so we never need to persist tool messages separately.
 */
export interface AIMessageProps {
    conversationId: string;
    role: AIMessageRole;
    /** SDK UIMessage parts — the source of truth for message content. */
    parts: UIMessage['parts'];
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
    toolCalls: Array<{ toolName: string; input: unknown }>;
    toolResults: Array<{ toolName: string; input: unknown; output: unknown }>;
}

export interface AIMessageTokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export default class AIMessage {
    constructor(
        public readonly id: string,
        public readonly props: AIMessageProps
    ) {}
}
