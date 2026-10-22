import type { InferUIMessageChunk, UIMessage } from 'ai';
import type { BaseEntity } from '../../shared/base';
import type { AIMessageRole } from './domain';

// The wire shape of a conversation is the AI SDK's UI message: the server stores exactly the
// parts it streamed, so what a reload shows is what the stream showed.
export interface ChatMessageMetadata{
    createdAt: string;
    // Order within the conversation; a message the server has not stored yet has none.
    position?: number;
}

export type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export type ChatMessagePart = ChatUIMessage['parts'][number];

export type ChatUIMessageChunk = InferUIMessageChunk<ChatUIMessage>;

export interface AIConversationMessage extends BaseEntity{
    conversationId: string;
    position: number;
    role: AIMessageRole;
    parts: ChatMessagePart[];
}
