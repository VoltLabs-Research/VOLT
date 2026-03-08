import { buildKeys, createMutation, createQuery } from '@/shared/infrastructure/query';
import chatService from '../../api/services/chat';
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

const setChatDetailCache = (queryClient: QueryClient, chat: Chat) => {
    queryClient.setQueryData(KEYS.detail(chat._id), chat);
};

export const addChatToCache = (queryClient: QueryClient, chat: Chat) => {
    queryClient.setQueryData<Chat[]>(KEYS.chats(), (current) => {
        if (!current) return [chat];
        if (current.some((existingChat) => existingChat._id === chat._id)) {
            return current;
        }
        return [chat, ...current];
    });

    setChatDetailCache(queryClient, chat);
};

export const replaceChatInCache = (queryClient: QueryClient, chat: Chat) => {
    queryClient.setQueryData<Chat[]>(KEYS.chats(), (current) => {
        if (!current) return [chat];

        const exists = current.some((existingChat) => existingChat._id === chat._id);
        if (!exists) {
            return [chat, ...current];
        }

        return current.map((existingChat) => {
            if (existingChat._id === chat._id) {
                return chat;
            }

            return existingChat;
        });
    });

    setChatDetailCache(queryClient, chat);
};

export const updateChatInCache = (queryClient: QueryClient, chatId: string, updates: Partial<Chat>) => {
    queryClient.setQueryData<Chat[]>(KEYS.chats(), (current) => {
        if (!current) return current;

        return current.map((chat) => {
            if (chat._id === chatId) {
                return { ...chat, ...updates };
            }

            return chat;
        });
    });

    queryClient.setQueryData<Chat | undefined>(KEYS.detail(chatId), (current) => {
        if (!current) return current;
        return { ...current, ...updates };
    });
};

export const removeChatFromCache = (queryClient: QueryClient, chatId: string) => {
    queryClient.setQueryData<Chat[]>(KEYS.chats(), (current) => {
        if (!current) return current;
        return current.filter((chat) => chat._id !== chatId);
    });

    queryClient.removeQueries({ queryKey: KEYS.detail(chatId) });
};

export const invalidateChatsQuery = (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({ queryKey: KEYS.chats() });
};

export const resetChatQueries = (queryClient: QueryClient) => {
    queryClient.removeQueries({ queryKey: ['chat'] });
};
