import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';

export interface ToggleMessageReactionInputDTO{
    userId: string;
    chatId: string;
    messageId: string;
    emoji: string;
};

export interface ToggleMessageReactionOutputDTO extends PersistedChatMessageDTO{}
