import type { ChatMessageType } from '../entities/chat-message';

export interface SendMessageDTO {
    content: string;
    messageType: ChatMessageType;
};

export interface SendMessageInputDTO {
    chatId: string;
    content: string;
    messageType: ChatMessageType;
};
