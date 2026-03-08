import { paginated, del, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AIConversation } from '../../entities/ai-conversation';
import type { CreateAIConversationParams, CreateAIConversationResult } from '../../dtos/create-ai-conversation';
import type { ListAIConversationsParams } from '../../dtos/list-ai-conversations';
import type { UpdateAIConversationParams } from '../../dtos/update-ai-conversation';

interface ConversationPathParams {
    conversationId: string;
};

type UpdateConversationInput = ConversationPathParams & UpdateAIConversationParams;

const endpoints = {
    listConversations: paginated<ListAIConversationsParams | undefined, PaginatedResponse<AIConversation>>('/'),
    createConversation: post<CreateAIConversationParams | undefined, CreateAIConversationResult>('/'),
    updateConversation: patch<UpdateConversationInput, AIConversation>('/:conversationId'),
    deleteConversation: del<ConversationPathParams>('/:conversationId')
};

export default endpoints;
