import { createService, paginated, request, post, patch, del } from '@/app/core/http/utilities/create-service';

import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ChatMessage, ChatMessageType } from '../types/message';

export interface DeleteMessageInput {
    chatId: string;
    messageId: string;
}

export interface EditMessageInput {
    chatId: string;
    messageId: string;
    content: string;
}

export interface GetChatMessagesInput {
    chatId: string;
    page: number;
    limit: number;
}

export interface SendFileMessageInput {
    chatId: string;
    file: File;
}

export interface SendMessageInput {
    chatId: string;
    content: string;
    messageType: ChatMessageType;
}

export interface ToggleReactionInput {
    chatId: string;
    messageId: string;
    emoji: string;
}

interface MarkAsReadParams {
    chatId: string;
}

const endpoints = {
    getMessages: paginated<GetChatMessagesInput, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInput, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageInput, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<DeleteMessageInput>('/:chatId/messages/:messageId'),
    sendFileMessage: request<SendFileMessageInput, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<MarkAsReadParams, void>('/:chatId/messages/read', {
        unwrap: 'void',
        body: () => ({})
    }),
    toggleReaction: patch<ToggleReactionInput, ChatMessage>('/:chatId/messages/:messageId/reactions')
};

export default createService({
    clients: {
        default: {
            basePath: '/chat-messages'
        }
    }
}, endpoints);
