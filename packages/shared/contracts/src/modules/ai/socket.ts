import type { tags } from 'typia';
import type { AIModelChoice } from './domain';
import type { AIConversationMessage, ChatUIMessageChunk } from './chat';

export const AI_CHAT_EVENTS = {
    join: 'ai-chat:join',
    leave: 'ai-chat:leave',
    send: 'ai-chat:send',
    stop: 'ai-chat:stop',
    chunk: 'ai-chat:chunk',
    saved: 'ai-chat:saved',
    toolInvoke: 'ai-chat:tool-invoke'
} as const;

export const aiConversationRoom = (conversationId: string): string => `ai-conversation:${conversationId}`;

export interface ChatJoinPayload{
    conversationId: string;
}

export interface ChatJoined{
    conversationId: string;
    live: boolean;
}

export interface ChatLeavePayload{
    conversationId: string;
}

export interface ChatTurnMessage{
    id: string & tags.Pattern<'^[0-9a-f]{24}$'>;
    text: string & tags.MinLength<1> & tags.MaxLength<32000>;
}

export interface ToolApprovalDecision{
    approvalId: string & tags.MinLength<1>;
    approved: boolean;
}

export interface ChatTurnPayload{
    conversationId: string;
    message?: ChatTurnMessage;
    approvals?: ToolApprovalDecision[] & tags.MaxItems<16>;
    model?: AIModelChoice;
}

export interface ChatStopPayload{
    conversationId: string;
}

export interface ChatChunkFrame{
    conversationId: string;
    chunk: ChatUIMessageChunk;
}

export interface ChatSavedFrame{
    conversationId: string;
    message: AIConversationMessage;
}

export interface BrowserToolInvocation{
    conversationId: string;
    // The team that owns the conversation, which the tab may no longer have selected.
    teamId: string;
    toolCallId: string;
    toolName: string;
    input: unknown;
}

export interface BrowserToolResult{
    ok: boolean;
    summary: string;
    reason?: string;
    hint?: string;
    data?: unknown;
}
