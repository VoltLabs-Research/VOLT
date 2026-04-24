import { buildKeys, createInfiniteQuery, createMutation } from '@/shared/infrastructure/query';
import messageService from '../../api/services/message';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ChatMessage } from '../../api/entities/message';
import type {
    DeleteMessageInputDTO,
    EditMessageInputDTO,
    GetChatMessagesInputDTO,
    SendFileMessageInputDTO,
    SendMessageInputDTO,
    ToggleReactionInputDTO
} from '../../api/dtos/message';

const DEFAULT_MESSAGES_LIMIT = 50;

interface InfiniteMessagesParams {
    chatId: string;
};

type MessageQueryKeyMap = {
    messages: GetChatMessagesInputDTO;
    infiniteMessages: InfiniteMessagesParams;
};

interface MarkAsReadParams {
    chatId: string;
};

interface UseChatMessagesInfiniteQueryParams {
    chatId: string;
    limit?: number;
};

interface UseChatMessagesInfiniteQueryOptions {
    enabled?: boolean;
};

const KEYS = buildKeys<MessageQueryKeyMap>('chat');

export const useMarkAsReadMutation = createMutation<void, MarkAsReadParams>(messageService.markAsRead);
export const useSendMessageMutation = createMutation<ChatMessage, SendMessageInputDTO>(messageService.sendMessage);
export const useSendFileMutation = createMutation<ChatMessage, SendFileMessageInputDTO>(messageService.sendFileMessage);
export const useEditMessageMutation = createMutation<ChatMessage, EditMessageInputDTO>(messageService.editMessage);
export const useDeleteMessageMutation = createMutation<void, DeleteMessageInputDTO>(messageService.deleteMessage);
export const useToggleReactionMutation = createMutation<ChatMessage, ToggleReactionInputDTO>(messageService.toggleReaction);

const getChatMessagesInfiniteQueryKey = (chatId: string) => KEYS.infiniteMessages({ chatId });

const chatMessages = createInfiniteQuery(
    KEYS.infiniteMessages,
    ({ chatId }, { page, limit }) => messageService.getMessages({ chatId, page, limit }),
    { defaultLimit: DEFAULT_MESSAGES_LIMIT }
);

export const useChatMessagesInfiniteQuery = (
    params: UseChatMessagesInfiniteQueryParams,
    options?: UseChatMessagesInfiniteQueryOptions
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
                pages: current.pages.map((page, index) => {
                    if (index === lastPageIndex) {
                        return {
                            ...page,
                            data: sortMessagesByCreatedAt([...page.data, message])
                        };
                    }

                    return page;
                }),
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
                    data: page.data.map((message) => {
                        if (message._id === messageId) {
                            return { ...message, ...updates };
                        }

                        return message;
                    })
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
