import service from '../api/service';
import { buildKeys, createPaginatedQuery, createQuery } from '@/shared/query';
import type { AIConversation } from '@/modules/ai/api/types/ai-conversation';
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

/**
 * Conversations use the shared paginated-query helper: it owns list/detail
 * cache maintenance (upsert/remove across every list variant), so we no longer
 * hand-roll prepend/filter/map patching here. teamId is not part of the cache
 * key — it is injected into the request path by the RBAC client, and all
 * `ai-conversations` queries are purged on team switch.
 */
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

/**
 * Messages are read-only on the client — they are written exclusively by the
 * chat stream and only ever listed/invalidated here, so a plain query (no CRUD
 * machinery) is the right fit.
 */
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
