import type { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';
import type { AIMessageDTO } from './ListAIConversationMessagesDTO';
import type { StreamTextResult, UIMessage } from 'ai';

export interface SendAIConversationMessageInputDTO {
    teamId: string;
    conversationId: string;
    userId: string;
    message?: string;
    messages?: UIMessage[];
    provider?: TeamAIProvider;
    model?: string;
}

export interface SendAIConversationMessageOutputDTO {
    streamResult: StreamTextResult<any, any>;
    userMessage?: AIMessageDTO;
}
