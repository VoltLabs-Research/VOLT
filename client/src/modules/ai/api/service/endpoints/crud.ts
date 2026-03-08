import { paginated, del, patch } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AIConversation } from '../../entities/ai-conversation';
import type { CreateAIConversationParams, CreateAIConversationResult } from '../../dtos/create-ai-conversation';
import type { ListAIConversationsParams } from '../../dtos/list-ai-conversations';
import type { UpdateAIConversationParams } from '../../dtos/update-ai-conversation';
import { post } from '@/app/core/http/utilities/create-service';

type UpdateConversationInput = { conversationId: string } & UpdateAIConversationParams;

const endpoints = {
    listConversations: paginated<ListAIConversationsParams | undefined, PaginatedResponse<AIConversation>>('/'),
    createConversation: post<CreateAIConversationParams | undefined, CreateAIConversationResult>(
        (params) => params?.message ? '/start' : '/'
    ),
    updateConversation: patch<UpdateConversationInput, AIConversation>('/:conversationId'),
    deleteConversation: del<{ conversationId: string }>('/:conversationId')
};

export default endpoints;
