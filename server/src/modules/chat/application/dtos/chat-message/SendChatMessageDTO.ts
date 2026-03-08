import { ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { ChatMessageMetadata, ChatMessageProps } from '@modules/chat/domain/entities/chat-message/ChatMessage';

export interface PersistedChatMessageDTO extends ChatMessageProps {
    _id: string;
};

export interface SendChatMessageInputDTO {
    userId: string;
    chatId: string;
    content: string;
    messageType: ChatMessageType;
    metadata?: ChatMessageMetadata;
};

export interface SendChatMessageOutputDTO extends PersistedChatMessageDTO {};
