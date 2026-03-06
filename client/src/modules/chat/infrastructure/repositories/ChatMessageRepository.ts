import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import { buildFileFormData } from '@/shared/utils/file';
import type IChatMessageRepository from '../../domain/port/IChatMessageRepository';
import type { ChatMessage } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SendMessageDTO } from '../../application/dtos/message';

@injectable()
export default class ChatMessageRepository extends BaseRepository implements IChatMessageRepository {
    constructor() {
        super('/chat-messages', { useRBAC: false });
    }

    async getMessages(
        chatId: string,
        params?: { page?: number; limit?: number }
    ): Promise<PaginatedResponse<ChatMessage>> {
        return this.getAllPaginated(`/${chatId}/messages`, params);
    }

    async sendMessage(chatId: string, dto: SendMessageDTO): Promise<ChatMessage> {
        const response = await this.client.post<ApiResponse<ChatMessage>>(
            `/${chatId}/messages`,
            dto
        );
        return this.unwrap(response);
    }

    async sendFileMessage(chatId: string, file: File): Promise<ChatMessage> {
        const formData = buildFileFormData([{ name: 'file', file }]);
        
        const response = await this.client.post<ApiResponse<ChatMessage>>(
            `/${chatId}/send-file`,
            formData
        );
        return this.unwrap(response);
    }

    async editMessage(chatId: string, messageId: string, content: string): Promise<ChatMessage> {
        const response = await this.client.patch<ApiResponse<ChatMessage>>(
            `/${chatId}/messages/${messageId}`,
            { content }
        );
        return this.unwrap(response);
    }

    async deleteMessage(chatId: string, messageId: string): Promise<void> {
        await this.client.delete(`/${chatId}/messages/${messageId}`);
    }

    async markAsRead(chatId: string): Promise<void> {
        await this.client.patch(`/${chatId}/read`);
    }

    async toggleReaction(chatId: string, messageId: string, emoji: string): Promise<ChatMessage> {
        const response = await this.client.post<ApiResponse<ChatMessage>>(
            `/${chatId}/messages/${messageId}/reaction`,
            { emoji }
        );
        return this.unwrap(response);
    }
};
