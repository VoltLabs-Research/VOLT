import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type IAIConversationRepository from '@/modules/ai/domain/port/IAIConversationRepository';
import type {
    CreateAIConversationParams,
    ListAIConversationMessagesParams,
    ListAIConversationsParams,
    UpdateAIConversationParams
} from '@/modules/ai/domain/port/IAIConversationRepository';
import type {
    AIConversation,
    AIConversationMessage
} from '@/modules/ai/domain/entities/AIConversation';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export default class AIConversationRepository extends BaseRepository implements IAIConversationRepository {
    constructor() {
        super('/ai/conversations', { useRBAC: true });
    }

    async listConversations(params?: ListAIConversationsParams): Promise<PaginatedResponse<AIConversation>> {
        return this.getAllPaginated('/', params);
    }

    async createConversation(params?: CreateAIConversationParams): Promise<AIConversation> {
        const response = await this.client.post<ApiResponse<AIConversation>>('/', params);
        return this.unwrap(response);
    }

    async updateConversation(conversationId: string, params: UpdateAIConversationParams): Promise<AIConversation> {
        const response = await this.client.patch<ApiResponse<AIConversation>>(`/${conversationId}`, params);
        return this.unwrap(response);
    }

    async deleteConversation(conversationId: string): Promise<void> {
        await this.client.delete(`/${conversationId}`);
    }

    async listMessages(
        conversationId: string,
        params?: ListAIConversationMessagesParams
    ): Promise<PaginatedResponse<AIConversationMessage>> {
        return this.getAllPaginated(`/${conversationId}/messages`, params);
    }
}

export const aiConversationRepository = new AIConversationRepository();
