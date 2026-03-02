import { AIConversationDTO } from './ListAIConversationsDTO';

export interface CreateAIConversationInputDTO {
    teamId: string;
    userId: string;
    title?: string;
    lastMessageAt?: Date | string | null;
    lastProvider?: string;
    lastModel?: string;
};

export interface CreateAIConversationOutputDTO extends AIConversationDTO { }
