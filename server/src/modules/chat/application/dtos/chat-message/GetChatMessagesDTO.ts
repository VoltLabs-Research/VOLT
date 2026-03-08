import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { PersistedChatMessageDTO } from '@modules/chat/application/dtos/chat-message/SendChatMessageDTO';

export interface GetChatMessagesInputDTO{
    userId: string;
    chatId: string;
    page?: number;
    limit?: number;
};

export interface GetChatMessagesOutputDTO extends PaginatedResult<PersistedChatMessageDTO>{}
