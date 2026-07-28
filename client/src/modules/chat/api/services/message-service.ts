import { createService, paginated, request, post, patch, del } from '@/app/core/http/utils/create-service';

import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ChatMessage, ChatMessageType } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageScopedParams, ChatScopedParams } from '@/modules/chat/contracts/api-params';
import type { EditMessageInput } from '@volt/contracts/modules/chat/http';

export type DeleteMessageInput = ChatMessageScopedParams;

export type EditMessageParams = ChatMessageScopedParams & EditMessageInput;

export interface GetChatMessagesInput extends ChatScopedParams {
    page: number;
    limit: number;
}

export interface SendFileMessageInput extends ChatScopedParams {
    file: File;
}

export interface SendMessageInput extends ChatScopedParams {
    content: string;
    messageType: ChatMessageType;
}

export interface ToggleReactionInput extends ChatMessageScopedParams {
    emoji: string;
}

const endpoints = {
    getMessages: paginated<GetChatMessagesInput, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInput, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageParams, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<DeleteMessageInput>('/:chatId/messages/:messageId'),
    sendFileMessage: request<SendFileMessageInput, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<ChatScopedParams, void>('/:chatId/messages/read', {
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
