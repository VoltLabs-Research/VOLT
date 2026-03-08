import type { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type { AIMessageDTO } from './ListAIConversationMessagesDTO';
import type { AIChatReplyStream } from '@modules/ai/domain/port/IAIChatTransport';
import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';

export interface SendAIConversationMessageInputDTO {
    teamId: string;
    conversationId: string;
    userId: string;
    message?: string;
    messages?: AIConversationMessage[];
    title?: string;
    provider?: TeamAIProvider;
    model?: string;
};

export interface SendAIConversationMessageOutputDTO {
    streamResult: AIChatReplyStream;
    userMessage?: AIMessageDTO;
    assistantMessage?: Promise<AIMessageDTO | undefined>;
};
