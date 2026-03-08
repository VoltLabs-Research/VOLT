import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import ChatMessage, { ChatMessageProps } from '@modules/chat/domain/entities/ChatMessage';

export interface IChatMessageRepository extends IBaseRepository<ChatMessage, ChatMessageProps>{
    markAllAsRead(
        chatId: string,
        userId: string
    ): Promise<void>;
};