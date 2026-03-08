import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { ChatTransport, UIMessage } from 'ai';

export interface AIModelSelection {
    provider?: AIProvider;
    model?: string;
};

export interface CreateConversationStreamTransportParams {
    teamId?: string;
    conversationId?: string;
    getModelSelection: () => AIModelSelection;
};

export type CreateConversationStreamTransportResult = ChatTransport<UIMessage>;
