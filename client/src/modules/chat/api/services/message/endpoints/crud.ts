import { paginated, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ChatMessage } from '../../../entities/message';
import type {
    DeleteMessageInputDTO,
    EditMessageInputDTO,
    GetChatMessagesInputDTO,
    SendMessageInputDTO
} from '../../../dtos/message';

const endpoints = {
    getMessages: paginated<GetChatMessagesInputDTO, PaginatedResponse<ChatMessage>>('/:chatId/messages'),
    sendMessage: post<SendMessageInputDTO, ChatMessage>('/:chatId/messages'),
    editMessage: patch<EditMessageInputDTO, ChatMessage>('/:chatId/messages/:messageId'),
    deleteMessage: del<DeleteMessageInputDTO>('/:chatId/messages/:messageId')
};

export default endpoints;
