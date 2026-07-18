import AIConversation, { AIConversationProps } from '@modules/ai/entities/AIConversation';
import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface IAIConversationRepository extends IBaseRepository<AIConversation, AIConversationProps> {
    /**
     * Loads a conversation that belongs to a given team+user, or null. This is
     * the module's ownership/authorization guard, centralized so every callsite
     * applies the same `{ _id, teamId, userId }` filter.
     */
    findOwnedByUser(conversationId: string, teamId: string, userId: string): Promise<AIConversation | null>;
}
