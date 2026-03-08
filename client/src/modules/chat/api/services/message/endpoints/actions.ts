import { request, patch } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { ChatMessage } from '../../../entities/message';
import type { SendFileMessageInputDTO, ToggleReactionInputDTO } from '../../../dtos/message';

interface MarkAsReadParams {
    chatId: string;
};

const endpoints = {
    sendFileMessage: request<SendFileMessageInputDTO, ChatMessage>('POST', '/:chatId/messages/file', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    markAsRead: patch<MarkAsReadParams, void>('/:chatId/messages/read', { unwrap: 'void' }),
    toggleReaction: patch<ToggleReactionInputDTO, ChatMessage>('/:chatId/messages/:messageId/reactions')
};

export default endpoints;
