import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import ChatMessage from '@modules/chat/entities/chat-message/ChatMessage';
import type { ChatMessageProps } from '@modules/chat/entities/chat-message/ChatMessage';

export interface IChatMessageRepository extends IBaseRepository<ChatMessage, ChatMessageProps> {
    markAllAsRead(
        chatId: string,
        userId: string
    ): Promise<void>;
}
