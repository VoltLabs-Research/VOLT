import { AIConversationDTO } from './ListAIConversationsDTO';

export interface UpdateAIConversationInputDTO {
    teamId: string;
    userId: string;
    conversationId: string;
    title?: string;
    isArchived?: boolean;
    lastMessageAt?: Date | string | null;
    lastProvider?: string | null;
    lastModel?: string | null;
};

export interface UpdateAIConversationOutputDTO extends AIConversationDTO { }
