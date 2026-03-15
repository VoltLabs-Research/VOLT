import { AIConversationDTO } from './ListAIConversationsDTO';
import type { AIMessageDTO } from './ListAIConversationMessagesDTO';

export interface CreateAIConversationInputDTO {
    teamId: string;
    userId: string;
    title?: string;
    message?: string;
};

export interface CreateAIConversationOutputDTO {
    conversation: AIConversationDTO;
    userMessage?: AIMessageDTO;
};
