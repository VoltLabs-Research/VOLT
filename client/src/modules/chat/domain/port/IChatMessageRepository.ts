import type { ChatMessage } from '../entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SendMessageDTO } from '../../application/dtos/message';

export default interface IChatMessageRepository {
    getMessages(chatId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ChatMessage>>;
    sendMessage(chatId: string, dto: SendMessageDTO): Promise<ChatMessage>;
    sendFileMessage(chatId: string, file: File): Promise<ChatMessage>;
    editMessage(chatId: string, messageId: string, content: string): Promise<ChatMessage>;
    deleteMessage(chatId: string, messageId: string): Promise<void>;
    markAsRead(chatId: string): Promise<void>;
    toggleReaction(chatId: string, messageId: string, emoji: string): Promise<ChatMessage>;
};
