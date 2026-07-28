import { createService, del, paginated, patch, post } from '@/app/core/http/utils/create-service';

import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type { AIConversationMessage } from '@/modules/ai/contracts/messages';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ChatTransport, UIMessage } from 'ai';

export interface CreateAIConversationParams {
    title?: string;
    message?: string;
}

export interface CreateAIConversationResult {
    conversation: AIConversation;
    userMessage?: AIConversationMessage;
}

export interface AIModelSelection {
    provider?: AIProvider;
    model?: string;
}

export interface CreateConversationStreamTransportParams {
    teamId?: string;
    conversationId?: string;
    getModelSelection: () => AIModelSelection;
}

export type CreateConversationStreamTransportResult = ChatTransport<UIMessage>;

export interface ListAIConversationMessagesParams {
    page?: number;
    limit?: number;
}

export interface ListAIConversationsParams {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
}

export interface UpdateAIConversationParams {
    title?: string;
    isArchived?: boolean;
}

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
