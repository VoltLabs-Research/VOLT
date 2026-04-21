import { paginated, request, post, patch, del } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ChatMessage } from '../entities/message';
import type {
    DeleteMessageInputDTO,
    EditMessageInputDTO,
    GetChatMessagesInputDTO,
    SendFileMessageInputDTO,
    SendMessageInputDTO,
    ToggleReactionInputDTO
} from '../dtos/message';

interface MarkAsReadParams {
    chatId: string;
};

const endpoints = {
    getMessages: paginated<GetChatMessagesInputDTO, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInputDTO, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageInputDTO, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<DeleteMessageInputDTO>('/:chatId/messages/:messageId'),
    sendFileMessage: request<SendFileMessageInputDTO, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<MarkAsReadParams, void>('/:chatId/messages/read', { unwrap: 'void' }),
    toggleReaction: patch<ToggleReactionInputDTO, ChatMessage>('/:chatId/messages/:messageId/reactions')
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/chat-messages'
        }
    },
    endpoints
});
