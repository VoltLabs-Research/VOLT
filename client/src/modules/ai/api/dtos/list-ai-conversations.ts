import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AIConversation } from '../entities/ai-conversation';

export interface ListAIConversationsParams {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
};

export type ListConversationsResult = PaginatedResponse<AIConversation>;
