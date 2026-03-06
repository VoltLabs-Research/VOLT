import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { ChatMessageProps } from '@modules/chat/domain/entities/ChatMessage';

export interface GetChatMessagesInputDTO{
    userId: string;
    chatId: string;
    page?: number;
    limit?: number;
};

export interface GetChatMessagesOutputDTO extends PaginatedResult<ChatMessageProps>{}