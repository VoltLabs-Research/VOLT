import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { AIConversationMessage } from '../entities/ai-conversation';

export interface ListAIConversationMessagesParams {
    page?: number;
    limit?: number;
};

export type ListConversationMessagesResult = PaginatedResponse<AIConversationMessage>;
