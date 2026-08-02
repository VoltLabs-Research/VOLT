import { createEntityCacheResource } from '@/shared/api/query-resources';
import { buildKeys, createMutation, createQuery } from '@/shared/query';
import chatService from '../../api/services/chat-service';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import type { GetOrCreateDirectChatInput } from '@volt/contracts/modules/chat/http';

type ChatQueryKeyMap = {
    chats: void;
    detail: string;
};

const KEYS = buildKeys<ChatQueryKeyMap>('chat');

export const useGetOrCreateChatMutation = createMutation<Chat, GetOrCreateDirectChatInput>(chatService.getOrCreate);

export const chatsQuery = createQuery(KEYS.chats, () => chatService.getAll({}));

const chatEntityCache = createEntityCacheResource<Chat>({
    listKey: KEYS.chats,
    detailKey: KEYS.detail,
    rootKey: () => ['chat']
});

export const addChatToCache = (chat: Chat) => {
    chatEntityCache.upsert(chat, { replaceExisting: false });
};

export const replaceChatInCache = (chat: Chat) => {
    chatEntityCache.upsert(chat);
};

export const updateChatInCache = (chatId: string, updates: Partial<Chat>) => {
    chatEntityCache.merge(chatId, updates);
};

export const removeChatFromCache = (chatId: string) => {
    chatEntityCache.remove(chatId);
};

export const invalidateChatsQuery = () => {
    return chatEntityCache.invalidateList();
};

export const resetChatQueries = () => {
    chatEntityCache.clearRoot();
};
