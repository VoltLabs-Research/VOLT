import type { AIConversationMessage, ChatUIMessage, ChatUIMessageChunk } from '@volt/contracts/modules/ai/chat';

export interface ChatToolContext {
    teamId: string;
    userId: string;
    conversationId: string;
    // The socket of the tab that drives the turn: browser tools run there.
    origin: string | null;
}

export type ChatFrame =
    | { type: 'chunk'; chunk: ChatUIMessageChunk }
    | { type: 'saved'; message: AIConversationMessage };

export interface ChatHistory {
    summary: string | null;
    messages: ChatUIMessage[];
}

export interface OpenCard {
    toolCallId: string;
    toolName: string;
    input: unknown;
    approvalId: string;
}
