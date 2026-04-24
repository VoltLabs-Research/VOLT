import type { ChatMessageType } from '../../entities/message';

export interface SendMessageInputDTO {
    chatId: string;
    content: string;
    messageType: ChatMessageType;
};
