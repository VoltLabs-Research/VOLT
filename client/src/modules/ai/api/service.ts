import { createService, del, paginated, patch, post } from '@/app/core/http/utilities/create-service';

import type { AIConversation, AIConversationMessage } from './entities/ai-conversation';
import type { CreateAIConversationParams, CreateAIConversationResult } from './dtos/create-ai-conversation';
import type { ListAIConversationMessagesParams } from './dtos/list-ai-conversation-messages';
import type { ListAIConversationsParams } from './dtos/list-ai-conversations';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { UpdateAIConversationParams } from './dtos/update-ai-conversation';

interface ConversationPathParams {
    conversationId: string;
}

type UpdateConversationInput = ConversationPathParams & UpdateAIConversationParams;

type ListMessagesInput = ConversationPathParams & ListAIConversationMessagesParams;

const endpoints = {
    listConversations: paginated<ListAIConversationsParams | undefined, PaginatedResponse<AIConversation>>('/'),
    createConversation: post<CreateAIConversationParams | undefined, CreateAIConversationResult>('/'),
    updateConversation: patch<UpdateConversationInput, AIConversation>('/:conversationId'),
    deleteConversation: del<ConversationPathParams>('/:conversationId'),
    listMessages: paginated<ListMessagesInput, PaginatedResponse<AIConversationMessage>>('/:conversationId/messages')
};

export default createService({
    clients: {
        default: {
            basePath: '/ai/conversations',
            useRBAC: true
        }
    }
}, endpoints);
