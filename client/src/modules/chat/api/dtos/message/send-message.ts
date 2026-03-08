import type { ChatMessageType } from '../../entities/message';

export interface SendMessageDTO {
    content: string;
    messageType: ChatMessageType;
};

export interface SendMessageInputDTO {
    chatId: string;
    content: string;
    messageType: ChatMessageType;
};
