import { AIConversationDTO } from './ListAIConversationsDTO';

export interface UpdateAIConversationInputDTO {
    teamId: string;
    userId: string;
    conversationId: string;
    title?: string;
    isArchived?: boolean;
};

export interface UpdateAIConversationOutputDTO extends AIConversationDTO { }
