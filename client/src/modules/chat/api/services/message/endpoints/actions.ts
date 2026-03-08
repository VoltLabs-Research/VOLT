import { request, patch } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { ChatMessage } from '../../../entities/chat-message';
import type { SendFileMessageInputDTO } from '../../../dtos/send-file-message';
import type { ToggleReactionInputDTO } from '../../../dtos/toggle-reaction';

const endpoints = {
    sendFileMessage: request<SendFileMessageInputDTO, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<{ chatId: string }, void>('/:chatId/messages/read', { unwrap: 'void' }),
    toggleReaction: patch<ToggleReactionInputDTO, ChatMessage>('/:chatId/messages/:messageId/reactions')
};

export default endpoints;
