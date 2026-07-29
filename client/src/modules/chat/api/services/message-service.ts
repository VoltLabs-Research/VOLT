import { createService, paginated, request, post, patch, put, del } from '@/app/core/http/utils/create-service';

import { buildFileFormData } from '@/shared/utils/file';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ChatMessage, ChatMessageType } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageScopedParams, ChatScopedParams } from '@/modules/chat/contracts/api-params';
import type { EditMessageInput } from '@volt/contracts/modules/chat/http';export type EditMessageParams = ChatMessageScopedParams & EditMessageInput;

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

export interface MessageReactionInput extends ChatMessageScopedParams {
    emoji: string;
}

const reactionPath = ({ chatId, messageId, emoji }: MessageReactionInput) => (
    `/${chatId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`
);

const endpoints = {
    getMessages: paginated<GetChatMessagesInput, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInput, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageParams, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<ChatMessageScopedParams>('/:chatId/messages/:messageId'),
    sendFileMessage: request<SendFileMessageInput, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{
            name: 'file',
            file
        }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<ChatScopedParams, void>('/:chatId/messages/read-status', {
        unwrap: 'void',
        body: () => ({})
    }),
    setReaction: put<MessageReactionInput, ChatMessage>(reactionPath, {
        query: () => undefined
    }),
    removeReaction: del<MessageReactionInput, ChatMessage>(reactionPath, {
        unwrap: 'data',
        query: () => undefined
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/chats'
        }
    }
}, endpoints);

export type DeleteMessageInput = ChatMessageScopedParams;
