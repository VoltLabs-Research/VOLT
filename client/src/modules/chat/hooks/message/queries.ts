import { buildKeys, createInfiniteQuery, createMutation, queryClient } from '@/shared/query';
import messageService from '../../api/services/message-service';
import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageScopedParams, ChatScopedParams } from '@/modules/chat/contracts/api-params';
import type { EditMessageParams, MessageReactionInput, SendFileMessageInput, SendMessageInput } from '../../api/services/message-service';

const DEFAULT_MESSAGES_LIMIT = 50;

type MessageQueryKeyMap = {
    infiniteMessages: ChatScopedParams;
};

const KEYS = buildKeys<MessageQueryKeyMap>('chat');

export const useMarkAsReadMutation = createMutation<void, ChatScopedParams>(messageService.markAsRead);
export const useSendMessageMutation = createMutation<ChatMessage, SendMessageInput>(messageService.sendMessage);
export const useSendFileMutation = createMutation<ChatMessage, SendFileMessageInput>(messageService.sendFileMessage);
export const useEditMessageMutation = createMutation<ChatMessage, EditMessageParams>(messageService.editMessage);
export const useDeleteMessageMutation = createMutation<void, ChatMessageScopedParams>(messageService.deleteMessage);
export const useSetReactionMutation = createMutation<ChatMessage, MessageReactionInput>(messageService.setReaction);
export const useRemoveReactionMutation = createMutation<ChatMessage, MessageReactionInput>(messageService.removeReaction);

export const useChatMessagesInfiniteQuery = createInfiniteQuery(
    KEYS.infiniteMessages,
    ({ chatId }: ChatScopedParams, { page, limit }) => messageService.getMessages({
        chatId,
        page,
        limit
    }),
    { defaultLimit: DEFAULT_MESSAGES_LIMIT }
);

export const addMessageToCache = (chatId: string | null, message: ChatMessage) => {
    if (!chatId) return;

    queryClient.setQueryData<InfiniteData<PaginatedResponse<ChatMessage>>>(
        KEYS.infiniteMessages({ chatId }),
        (current) => {
            if (!current) return current;

            const hasMessage = current.pages.some((page) => (
                page.data.some((existingMessage) => existingMessage._id === message._id)
            ));

            if (hasMessage) {
                return current;
            }

            const lastPageIndex = current.pages.length - 1;

            return {
                ...current,
                pages: current.pages.map((page, index) => {
                    if (index === lastPageIndex) {
                        return {
                            ...page,
                            data: [...page.data, message]
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
    chatId: string | null,
    messageId: string,
    updates: Partial<ChatMessage>
) => {
    if (!chatId) return;

    queryClient.setQueryData<InfiniteData<PaginatedResponse<ChatMessage>>>(
        KEYS.infiniteMessages({ chatId }),
        (current) => {
            if (!current) return current;

            return {
                ...current,
                pages: current.pages.map((page) => ({
                    ...page,
                    data: page.data.map((message) => {
                        if (message._id === messageId) {
                            return {
                                ...message,
                                ...updates
                            };
                        }

                        return message;
                    })
                })),
                pageParams: current.pageParams
            };
        }
    );
};

export const removeChatMessagesFromCache = (chatId: string) => {
    queryClient.removeQueries({ queryKey: KEYS.infiniteMessages({ chatId }) });
};
