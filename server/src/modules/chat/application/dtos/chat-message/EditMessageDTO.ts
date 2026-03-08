import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';

export interface EditMessageInputDTO{
    userId: string;
    chatId: string;
    messageId: string;
    content: string;
};

export interface EditMessageOutputDTO extends PersistedChatMessageDTO{}
