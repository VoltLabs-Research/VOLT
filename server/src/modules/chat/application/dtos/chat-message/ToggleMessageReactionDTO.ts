import { ChatMessageProps } from '@modules/chat/domain/entities/ChatMessage';

export interface ToggleMessageReactionInputDTO{
    userId: string;
    messageId: string;
    emoji: string;
};

export interface ToggleMessageReactionOutputDTO extends ChatMessageProps{}