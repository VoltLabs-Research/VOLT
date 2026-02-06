import { ChatMessageMetadata, ChatMessageProps, ChatMessageType } from '@modules/chat/domain/entities/ChatMessage';

export interface SendChatMessageInputDTO{
    userId: string;
    chatId: string;
    content: string;
    messageType: ChatMessageType;
    metadata?: ChatMessageMetadata;
};

export interface SendChatMessageOutputDTO extends ChatMessageProps{}