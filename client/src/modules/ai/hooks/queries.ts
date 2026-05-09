import { createConversationStreamTransport } from '../services/stream-transport';
import service from '../api/service';
import { buildKeys, createMutation, createQuery, queryClient } from '@/shared/infrastructure/query';
import type { AIConversation } from '@/modules/ai/api/entities/ai-conversation';
import type {
    CreateAIConversationParams,
    CreateAIConversationResult,
    CreateConversationStreamTransportParams,
    CreateConversationStreamTransportResult,
    ListAIConversationMessagesParams,
    ListAIConversationsParams,
    UpdateAIConversationParams
} from '@/modules/ai/api/service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { MutationOptions } from '@/shared/infrastructure/query';

export interface ConversationsQueryParams {
    teamId: string;
    params?: ListAIConversationsParams;
}

export interface ConversationMessagesQueryParams {
    teamId: string;
    conversationId: string;
    params?: ListAIConversationMessagesParams;
}

interface AIQueryKeyMap {
    conversations: ConversationsQueryParams;
    messages: ConversationMessagesQueryParams;
}

interface DeleteConversationVariables {
    conversationId: string;
}

type UpdateConversationVariables = DeleteConversationVariables & UpdateAIConversationParams;

export interface ConversationMutationOptions {
    conversationsQueryParams?: ConversationsQueryParams;
}

const KEYS = buildKeys<AIQueryKeyMap>('ai');

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
        (current) => {
            let nextValue = current;

            if (current) {
                nextValue = updater(current);
            }

            return nextValue;
        }
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

export const invalidateConversationMessagesQuery = messagesQuery.invalidate;

export const invalidateConversationsQueries = () => {
    return queryClient.invalidateQueries({ queryKey: KEYS.conversations() });
};

export const useCreateConversationMutation = (
    { conversationsQueryParams }: ConversationMutationOptions = {},
    options?: MutationOptions<CreateAIConversationResult, CreateAIConversationParams>
) => createMutation<CreateAIConversationResult, CreateAIConversationParams>(
    service.createConversation,
    ({ conversation }) => {
        patchConversations(conversationsQueryParams, (current) => ({
            ...current,
            data: sortConversations([
                conversation,
                ...current.data.filter((item) => item._id !== conversation._id)
            ])
        }));
    }
)(options);

export const useDeleteConversationMutation = (
    { conversationsQueryParams }: ConversationMutationOptions = {},
    options?: MutationOptions<void, DeleteConversationVariables>
) => createMutation<void, DeleteConversationVariables>(
    service.deleteConversation,
    (_data, variables) => {
        patchConversations(conversationsQueryParams, (current) => ({
            ...current,
            data: current.data.filter((conversation) => conversation._id !== variables.conversationId)
        }));
    }
)(options);

export const useRenameConversationMutation = (
    { conversationsQueryParams }: ConversationMutationOptions = {},
    options?: MutationOptions<AIConversation, UpdateConversationVariables>
) => createMutation<AIConversation, UpdateConversationVariables>(
    service.updateConversation,
    (updatedConversation, variables) => {
        const updatedConversations = (current: PaginatedResponse<AIConversation>) => {
            const conversations = current.data.map((conversation) => {
                if (conversation._id === variables.conversationId) {
                    return updatedConversation;
                }

                return conversation;
            });

            return {
                ...current,
                data: sortConversations(conversations)
            };
        };

        patchConversations(conversationsQueryParams, (current) => ({
            ...updatedConversations(current)
        }));
    }
)(options);

export const resolveConversationStreamTransport = (
    params: CreateConversationStreamTransportParams
): CreateConversationStreamTransportResult => {
    return createConversationStreamTransport(params);
};
