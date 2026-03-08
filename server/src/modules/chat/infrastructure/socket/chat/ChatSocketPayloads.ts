import type { ChatMessageMetadata, ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';

export interface SendMessagePayload {
    chatId: string;
    content: string;
    messageType?: ChatMessageType;
    metadata?: ChatMessageMetadata;
};

export interface EditMessagePayload {
    chatId: string;
    messageId: string;
    content: string;
};

export interface DeleteMessagePayload {
    chatId: string;
    messageId: string;
};

export interface ToggleReactionPayload {
    chatId: string;
    messageId: string;
    emoji: string;
};

export interface MarkReadPayload {
    chatId: string;
};

export interface TypingPayload {
    chatId: string;
};

export interface GetUsersPresencePayload {
    userIds: string[];
};
