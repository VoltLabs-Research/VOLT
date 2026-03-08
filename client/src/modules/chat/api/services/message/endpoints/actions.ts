import { request, post, patch } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { ChatMessage } from '../../../entities/chat-message';
import type { SendFileMessageInputDTO } from '../../../dtos/send-file-message';
import type { ToggleReactionInputDTO } from '../../../dtos/toggle-reaction';

const endpoints = {
    sendFileMessage: request<SendFileMessageInputDTO, ChatMessage>('POST', '/:chatId/send-file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<{ chatId: string }, void>('/:chatId/read', { unwrap: 'void' }),
    toggleReaction: post<ToggleReactionInputDTO, ChatMessage>('/:chatId/messages/:messageId/reaction')
};

export default endpoints;
