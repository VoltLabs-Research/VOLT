import service from '../api/service';
import { buildKeys, createPaginatedQuery, createQuery } from '@/shared/query';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type {
    CreateAIConversationParams,
    ListAIConversationMessagesParams,
    ListAIConversationsParams,
    UpdateAIConversationParams
} from '@/modules/ai/api/service';

export interface ConversationMessagesQueryParams {
    teamId: string;
    conversationId: string;
    params?: ListAIConversationMessagesParams;
}

interface AIMessagesKeyMap {
    messages: ConversationMessagesQueryParams;
}

const MESSAGE_KEYS = buildKeys<AIMessagesKeyMap>('ai');

const CONVERSATIONS_BASE_KEY = 'ai-conversations';

export const conversationQuery = createPaginatedQuery<
    AIConversation,
    ListAIConversationsParams,
    CreateAIConversationParams,
    UpdateAIConversationParams
>({
    baseKey: CONVERSATIONS_BASE_KEY,
    detailKey: (id) => [CONVERSATIONS_BASE_KEY, 'detail', id],
    service: {
        list: service.listConversations,
        create: (params) => service.createConversation(params).then((result) => result.conversation),
        update: (id, params) => service.updateConversation({ conversationId: id, ...params }),
        delete: async (id) => {
            await service.deleteConversation({ conversationId: id });
        }
    }
});

export const invalidateConversationsQueries = (): Promise<void> => conversationQuery.cache.invalidate();

export const messagesQuery = createQuery(
    MESSAGE_KEYS.messages,
    ({ conversationId, params }: ConversationMessagesQueryParams) => service.listMessages({ conversationId, ...params })
);

export const buildConversationMessagesQueryParams = (
    teamId: string,
    conversationId: string,
    params?: ListAIConversationMessagesParams
): ConversationMessagesQueryParams => ({
    teamId,
    conversationId,
    params
});

export const invalidateConversationMessagesQuery = messagesQuery.invalidate;
