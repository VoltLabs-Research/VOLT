import service from '../api/service';
import { createQuery } from '@/shared/query/create-query';
import queryClient from '@/shared/query/query-client';
import type { ConversationParams, ListAIConversationMessagesParams } from '@/modules/ai/api/service';

const CONVERSATIONS_KEY = 'ai-conversations';
const MESSAGES_KEY = 'ai-conversation-messages';

export const conversationsQuery = createQuery(
    (teamId: string) => [CONVERSATIONS_KEY, teamId],
    (teamId: string) => service.listConversations({
        teamId,
        page: 1,
        limit: 100
    })
);

export const conversationQuery = createQuery(
    ({ conversationId }: ConversationParams) => [CONVERSATIONS_KEY, 'detail', conversationId],
    (params: ConversationParams) => service.getConversation(params)
);

export const messagesWindowQuery = createQuery(
    ({ conversationId, page, limit }: ListAIConversationMessagesParams) => [MESSAGES_KEY, conversationId, page, limit],
    (params: ListAIConversationMessagesParams) => service.listMessages(params)
);

export const invalidateConversations = (): Promise<void> => queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });

export const forgetMessages = (conversationId: string): void => {
    queryClient.removeQueries({ queryKey: [MESSAGES_KEY, conversationId] });
};
