import { createService, del, get, paginated, patch, post } from '@/app/core/http/utils/create-service';
import type { AIConversation, AIConversationCompacted } from '@volt/contracts/modules/ai/domain';
import type { AIConversationMessage } from '@volt/contracts/modules/ai/chat';
import type { PaginatedResponse } from '@voltstack/voltclient';

interface TeamParams {
    teamId: string;
}

export interface ConversationParams extends TeamParams {
    conversationId: string;
}

export interface ListAIConversationsParams extends TeamParams {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
}

export interface CreateAIConversationParams extends TeamParams {
    title?: string;
}

export interface UpdateAIConversationParams extends ConversationParams {
    title?: string;
    isArchived?: boolean;
}

export interface ListAIConversationMessagesParams extends ConversationParams {
    page: number;
    limit: number;
}

// A conversation is always addressed under the team that owns it, not the team selected now:
// switching team must not cut a conversation off from its own history.
const endpoints = {
    listConversations: paginated<ListAIConversationsParams, PaginatedResponse<AIConversation>>('/:teamId/ai-conversations'),
    createConversation: post<CreateAIConversationParams, AIConversation>('/:teamId/ai-conversations'),
    getConversation: get<ConversationParams, AIConversation>('/:teamId/ai-conversations/:conversationId'),
    updateConversation: patch<UpdateAIConversationParams, AIConversation>('/:teamId/ai-conversations/:conversationId'),
    deleteConversation: del<ConversationParams>('/:teamId/ai-conversations/:conversationId'),
    listMessages: paginated<ListAIConversationMessagesParams, PaginatedResponse<AIConversationMessage>>('/:teamId/ai-conversations/:conversationId/messages'),
    compactConversation: post<ConversationParams, AIConversationCompacted>('/:teamId/ai-conversations/:conversationId/compact')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
