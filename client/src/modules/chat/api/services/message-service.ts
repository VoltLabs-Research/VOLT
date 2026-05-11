import { createService, paginated, request, post, patch, del } from '@/app/core/http/utilities/create-service';

import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ChatMessage, ChatMessageType } from '../entities/message';

export interface DeleteMessageInputDTO {
    chatId: string;
    messageId: string;
}

export interface EditMessageInputDTO {
    chatId: string;
    messageId: string;
    content: string;
}

export interface GetChatMessagesInputDTO {
    chatId: string;
    page: number;
    limit: number;
}

export interface SendFileMessageInputDTO {
    chatId: string;
    file: File;
}

export interface SendMessageInputDTO {
    chatId: string;
    content: string;
    messageType: ChatMessageType;
}

export interface ToggleReactionInputDTO {
    chatId: string;
    messageId: string;
    emoji: string;
}

interface MarkAsReadParams {
    chatId: string;
}

const endpoints = {
    getMessages: paginated<GetChatMessagesInputDTO, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInputDTO, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageInputDTO, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<DeleteMessageInputDTO>('/:chatId/messages/:messageId'),
    sendFileMessage: request<SendFileMessageInputDTO, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<MarkAsReadParams, void>('/:chatId/messages/read', {
        unwrap: 'void',
        body: () => ({})
    }),
    toggleReaction: patch<ToggleReactionInputDTO, ChatMessage>('/:chatId/messages/:messageId/reactions')
};

export default createService({
    clients: {
        default: {
            basePath: '/chat-messages'
        }
    }
}, endpoints);
