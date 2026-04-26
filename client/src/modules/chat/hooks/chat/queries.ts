import { createEntityCacheResource } from '@/shared/api/query-resources';
import { buildKeys, createMutation, createQuery } from '@/shared/infrastructure/query';
import chatService from '../../api/services/chat-service';
import type { QueryClient } from '@tanstack/react-query';
import type { Chat } from '../../api/entities/chat';
import type { GetOrCreateChatInputDTO } from '../../api/dtos/chat';

type ChatQueryKeyMap = {
    chats: void;
    detail: string;
}; 

const KEYS = buildKeys<ChatQueryKeyMap>('chat');

export const CHAT_QUERY_KEYS = {
    chats: KEYS.chats,
    detail: KEYS.detail
};

export const useGetOrCreateChatMutation = createMutation<Chat, GetOrCreateChatInputDTO>(chatService.getOrCreate);

export const chatsQuery = createQuery(KEYS.chats, () => chatService.getAll({}));

const chatEntityCache = createEntityCacheResource<Chat>({
    listKey: KEYS.chats,
    detailKey: KEYS.detail,
    rootKey: () => ['chat']
});

export const addChatToCache = (queryClient: QueryClient, chat: Chat) => {
    chatEntityCache.upsert(chat, { client: queryClient, replaceExisting: false });
};

export const replaceChatInCache = (queryClient: QueryClient, chat: Chat) => {
    chatEntityCache.upsert(chat, { client: queryClient });
};

export const updateChatInCache = (queryClient: QueryClient, chatId: string, updates: Partial<Chat>) => {
    chatEntityCache.merge(chatId, updates, queryClient);
};

export const removeChatFromCache = (queryClient: QueryClient, chatId: string) => {
    chatEntityCache.remove(chatId, queryClient);
};

export const invalidateChatsQuery = (queryClient: QueryClient) => {
    return chatEntityCache.invalidateList(queryClient);
};

export const resetChatQueries = (queryClient: QueryClient) => {
    chatEntityCache.clearRoot(queryClient);
};
