import { buildKeys, createInfiniteQuery, createMutation } from '@/shared/infrastructure/query';
import messageService from '../../api/services/message';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ChatMessage } from '../../api/entities/chat-message';
import type { GetChatMessagesInputDTO } from '../../api/dtos/get-chat-messages';
import type { SendMessageInputDTO } from '../../api/dtos/send-message';
import type { SendFileMessageInputDTO } from '../../api/dtos/send-file-message';
import type { EditMessageInputDTO } from '../../api/dtos/edit-message';
import type { DeleteMessageInputDTO } from '../../api/dtos/delete-message';
import type { ToggleReactionInputDTO } from '../../api/dtos/toggle-reaction';

const DEFAULT_MESSAGES_LIMIT = 50;

const KEYS = buildKeys<{
    messages: GetChatMessagesInputDTO;
    infiniteMessages: { chatId: string };
}>('chat');

export const MESSAGE_QUERY_KEYS = {
    messages: KEYS.messages,
    infiniteMessages: KEYS.infiniteMessages
} as const;

export const useMarkAsReadMutation = createMutation<void, { chatId: string }>(messageService.markAsRead);
export const useSendMessageMutation = createMutation<ChatMessage, SendMessageInputDTO>(messageService.sendMessage);
export const useSendFileMutation = createMutation<ChatMessage, SendFileMessageInputDTO>(messageService.sendFileMessage);
export const useEditMessageMutation = createMutation<ChatMessage, EditMessageInputDTO>(messageService.editMessage);
export const useDeleteMessageMutation = createMutation<void, DeleteMessageInputDTO>(messageService.deleteMessage);
export const useToggleReactionMutation = createMutation<ChatMessage, ToggleReactionInputDTO>(messageService.toggleReaction);

export const getChatMessagesQueryKey = KEYS.messages;
export const getChatMessagesInfiniteQueryKey = (chatId: string) => KEYS.infiniteMessages({ chatId });

export const buildChatMessagesQueryParams = (
    chatId: string,
    page: number,
    limit: number = DEFAULT_MESSAGES_LIMIT
): GetChatMessagesInputDTO => ({ chatId, page, limit });

export const buildChatMessagesQueryOptions = (params: GetChatMessagesInputDTO) => ({
    queryKey: getChatMessagesQueryKey(params),
    queryFn: () => messageService.getMessages({ chatId: params.chatId, page: params.page, limit: params.limit })
});

const chatMessages = createInfiniteQuery(
    KEYS.infiniteMessages,
    ({ chatId }, { page, limit }) => messageService.getMessages({ chatId, page, limit }),
    { defaultLimit: DEFAULT_MESSAGES_LIMIT }
);

export const useChatMessagesInfiniteQuery = (
    params: { chatId: string; limit?: number },
    options?: { enabled?: boolean }
) => {
    return chatMessages({ chatId: params.chatId }, {
        enabled: options?.enabled
    });
};

const sortMessagesByCreatedAt = (messages: ChatMessage[]) => {
    return [...messages].sort((left, right) => {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
};

export const addMessageToCache = (queryClient: QueryClient, chatId: string | null | undefined, message: ChatMessage) => {
    if (!chatId) return;

    queryClient.setQueryData<InfiniteData<PaginatedResponse<ChatMessage>>>(
        getChatMessagesInfiniteQueryKey(chatId),
        (current) => {
            if (!current) return current;

            const hasMessage = current.pages.some((page) => (
                page.data.some((existingMessage) => existingMessage._id === message._id)
            ));

            if (hasMessage) {
                return current;
            }

            const lastPageIndex = current.pages.length - 1;
            const lastPage = current.pages[lastPageIndex];

            if (!lastPage) {
                return current;
            }

            return {
                ...current,
                pages: current.pages.map((page, index) => (
                    index === lastPageIndex
                        ? {
                            ...page,
                            data: sortMessagesByCreatedAt([...page.data, message])
                        }
                        : page
                )),
                pageParams: current.pageParams
            };
        }
    );
};

export const updateMessageInCache = (
    queryClient: QueryClient,
    chatId: string | null | undefined,
    messageId: string,
    updates: Partial<ChatMessage>
) => {
    if (!chatId) return;

    queryClient.setQueryData<InfiniteData<PaginatedResponse<ChatMessage>>>(
        getChatMessagesInfiniteQueryKey(chatId),
        (current) => {
            if (!current) return current;

            return {
                ...current,
                pages: current.pages.map((page) => ({
                    ...page,
                    data: page.data.map((message) => message._id === messageId ? { ...message, ...updates } : message)
                })),
                pageParams: current.pageParams
            };
        }
    );
};

export const removeChatMessagesFromCache = (queryClient: QueryClient, chatId: string) => {
    queryClient.removeQueries({ queryKey: getChatMessagesInfiniteQueryKey(chatId) });
    queryClient.removeQueries({
        predicate: (query) => {
            const [scope, resource, params] = query.queryKey;
            return scope === 'chat'
                && resource === 'messages'
                && typeof params === 'object'
                && params !== null
                && 'chatId' in params
                && params.chatId === chatId;
        }
    });
};
