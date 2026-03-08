import { paginated } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AIConversationMessage } from '../../entities/ai-conversation';
import type { ListAIConversationMessagesParams } from '../../dtos/list-ai-conversation-messages';

type ListMessagesInput = { conversationId: string } & ListAIConversationMessagesParams;

const endpoints = {
    listMessages: paginated<ListMessagesInput, PaginatedResponse<AIConversationMessage>>('/:conversationId/messages')
};

export default endpoints;
