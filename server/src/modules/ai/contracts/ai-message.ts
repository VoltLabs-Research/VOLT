export enum AIConversationMessageRole {
    User = 'user',
    Assistant = 'assistant'
}

export type AIMessagePart = {
    type: string;
} & Record<string, unknown>;

export type AIMessageParts = AIMessagePart[];

export interface AIConversationMessage {
    id: string;
    role: AIConversationMessageRole;
    parts: AIMessageParts;
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

export interface AIMessageToolStep {
    stepNumber: number;
    toolCalls: AIMessageToolCall[];
    toolResults: AIMessageToolResult[];
}

export interface AIMessageModelInfo {
    provider: string;
    model: string;
    finishReason: string;
    steps: AIMessageToolStep[];
}

export interface AIMessageTokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}
