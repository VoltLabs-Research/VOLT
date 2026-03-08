import { paginated, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ChatMessage } from '../../../entities/chat-message';
import type { GetChatMessagesInputDTO } from '../../../dtos/get-chat-messages';
import type { SendMessageInputDTO } from '../../../dtos/send-message';
import type { EditMessageInputDTO } from '../../../dtos/edit-message';
import type { DeleteMessageInputDTO } from '../../../dtos/delete-message';

const endpoints = {
    getMessages: paginated<GetChatMessagesInputDTO, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInputDTO, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageInputDTO, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<DeleteMessageInputDTO>('/:chatId/messages/:messageId')
};

export default endpoints;
