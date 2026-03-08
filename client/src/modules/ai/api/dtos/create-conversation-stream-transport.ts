import type { ChatTransport, UIMessage } from 'ai';

export interface CreateConversationStreamTransportParams {
    teamId?: string;
    conversationId?: string;
    getModelSelection: () => {
        provider?: string;
        model?: string;
    };
};

export type CreateConversationStreamTransportResult = ChatTransport<UIMessage>;
