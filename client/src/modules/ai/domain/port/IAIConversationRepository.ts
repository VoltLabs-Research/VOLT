import type { TeamAIProvider } from '@/modules/team/domain/entities/TeamAIIntegration';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type {
    AIConversation,
    AIConversationMessage
} from '@/modules/ai/domain/entities/AIConversation';

export interface ListAIConversationsParams {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
}

export interface CreateAIConversationParams {
    title?: string;
    lastProvider?: TeamAIProvider;
    lastModel?: string;
}

export interface UpdateAIConversationParams {
    title?: string;
    isArchived?: boolean;
    lastProvider?: TeamAIProvider;
    lastModel?: string;
}

export interface ListAIConversationMessagesParams {
    page?: number;
    limit?: number;
}

export default interface IAIConversationRepository {
    listConversations(params?: ListAIConversationsParams): Promise<PaginatedResponse<AIConversation>>;
    createConversation(params?: CreateAIConversationParams): Promise<AIConversation>;
    updateConversation(conversationId: string, params: UpdateAIConversationParams): Promise<AIConversation>;
    deleteConversation(conversationId: string): Promise<void>;
    listMessages(conversationId: string, params?: ListAIConversationMessagesParams): Promise<PaginatedResponse<AIConversationMessage>>;
}
