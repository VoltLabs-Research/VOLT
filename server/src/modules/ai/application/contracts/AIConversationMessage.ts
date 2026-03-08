export type AIConversationMessageRole = 'user' | 'assistant' | 'system';

export type AIConversationMessagePart = {
    type: string;
} & Record<string, unknown>;

export type AIConversationMessageParts = AIConversationMessagePart[];

export interface AIConversationMessage {
    id: string;
    role: AIConversationMessageRole;
    parts: AIConversationMessageParts;
}
