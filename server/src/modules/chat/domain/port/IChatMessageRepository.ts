import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import ChatMessage, { ChatMessageProps } from '@modules/chat/domain/entities/ChatMessage';

export interface IChatMessageRepository extends IBaseRepository<ChatMessage, ChatMessageProps>{
    /**
     * Mark a message as read.
     */
    markMessageAsRead(
        chatId: string,
        userId: string
    ): Promise<void>;
};