import { useMutation } from '@tanstack/react-query';
import { buildKeys, createQuery, queryClient, withSuccess, type MutationOptions} from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ChatTransport, UIMessage } from 'ai';
import service from '../api/service';
import type { AIConversation } from '@/modules/ai/api/entities/ai-conversation';
import type { CreateAIConversationParams, CreateAIConversationResult } from '@/modules/ai/api/dtos/create-ai-conversation';
import type { CreateConversationStreamTransportParams } from '@/modules/ai/api/dtos/create-conversation-stream-transport';
import type { ListAIConversationMessagesParams } from '@/modules/ai/api/dtos/list-ai-conversation-messages';
import type { ListAIConversationsParams } from '@/modules/ai/api/dtos/list-ai-conversations';
import type { UpdateAIConversationParams } from '@/modules/ai/api/dtos/update-ai-conversation';

export interface ConversationsQueryParams {
    teamId: string;
    params?: ListAIConversationsParams;
}

export interface ConversationMessagesQueryParams {
    teamId: string;
    conversationId: string;
    params?: ListAIConversationMessagesParams;
}

type DeleteConversationVariables = { conversationId: string };
type UpdateConversationVariables = { conversationId: string } & UpdateAIConversationParams;

export interface ConversationMutationOptions {
    conversationsQueryParams?: ConversationsQueryParams;
}

const KEYS = buildKeys<{
    conversations: ConversationsQueryParams;
    messages: ConversationMessagesQueryParams;
}>('ai');

export const conversationsQuery = createQuery(
    KEYS.conversations,
    ({ params }: ConversationsQueryParams) => service.listConversations(params)
);

export const messagesQuery = createQuery(
    KEYS.messages,
    ({ conversationId, params }: ConversationMessagesQueryParams) => service.listMessages({ conversationId, ...params })
);

const sortConversations = (items: AIConversation[]) => {
    return [...items].sort((left, right) => {
        const leftDate = left.lastMessageAt || left.updatedAt || left.createdAt;
        const rightDate = right.lastMessageAt || right.updatedAt || right.createdAt;
        return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });
};

const patchConversations = (
    queryParams: ConversationsQueryParams | undefined,
    updater: (current: PaginatedResponse<AIConversation>) => PaginatedResponse<AIConversation>
) => {
    if (!queryParams) return;

    queryClient.setQueryData<PaginatedResponse<AIConversation>>(
        KEYS.conversations(queryParams),
        (current) => (current ? updater(current) : current)
    );
};

export const buildConversationsQueryParams = (
    teamId: string,
    params?: ListAIConversationsParams
): ConversationsQueryParams => ({
    teamId,
    params
});

export const buildConversationMessagesQueryParams = (
    teamId: string,
    conversationId: string,
    params?: ListAIConversationMessagesParams
): ConversationMessagesQueryParams => ({
    teamId,
    conversationId,
    params
});

export const invalidateConversationMessagesQuery = (params: ConversationMessagesQueryParams) => {
    return messagesQuery.invalidate(params);
};

export const invalidateConversationsQueries = () => {
    return queryClient.invalidateQueries({ queryKey: KEYS.conversations() });
};

export const useCreateConversationMutation = (
    { conversationsQueryParams }: ConversationMutationOptions = {},
    options?: MutationOptions<CreateAIConversationResult, CreateAIConversationParams>
) => {
    return useMutation({
        ...options,
        mutationFn: service.createConversation,
        onSuccess: withSuccess(({ conversation, userMessage }) => {
            patchConversations(conversationsQueryParams, (current) => ({
                ...current,
                data: sortConversations([
                    conversation,
                    ...current.data.filter((item) => item._id !== conversation._id)
                ])
            }));

            if (!userMessage) return;

            messagesQuery.set(
                buildConversationMessagesQueryParams(conversation.teamId, conversation._id, {
                    page: 1,
                    limit: 200
                }),
                {
                    status: 'success',
                    data: [userMessage],
                    pagination: {
                        page: 1,
                        limit: 200,
                        total: 1,
                        totalPages: 1,
                        hasMore: false
                    }
                }
            );
        }, options)
    });
};

export const useDeleteConversationMutation = (
    { conversationsQueryParams }: ConversationMutationOptions = {},
    options?: MutationOptions<void, DeleteConversationVariables>
) => {
    return useMutation({
        ...options,
        mutationFn: service.deleteConversation,
        onSuccess: withSuccess((_data, variables) => {
            patchConversations(conversationsQueryParams, (current) => ({
                ...current,
                data: current.data.filter((conversation) => conversation._id !== variables.conversationId)
            }));
        }, options)
    });
};

export const useRenameConversationMutation = (
    { conversationsQueryParams }: ConversationMutationOptions = {},
    options?: MutationOptions<AIConversation, UpdateConversationVariables>
) => {
    return useMutation({
        ...options,
        mutationFn: service.updateConversation,
        onSuccess: withSuccess((updatedConversation, variables) => {
            patchConversations(conversationsQueryParams, (current) => ({
                ...current,
                data: sortConversations(current.data.map((conversation) => (
                    conversation._id === variables.conversationId
                        ? updatedConversation
                        : conversation
                )))
            }));
        }, options)
    });
};

export const resolveConversationStreamTransport = (
    params: CreateConversationStreamTransportParams
): ChatTransport<UIMessage> => {
    return service.createStreamTransport(params) as unknown as ChatTransport<UIMessage>;
};
