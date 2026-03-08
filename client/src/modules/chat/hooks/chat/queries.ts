import { buildKeys, createMutation, createQuery } from '@/shared/infrastructure/query';
import chatService from '../../api/services/chat';
import type { QueryClient } from '@tanstack/react-query';
import type { Chat } from '../../api/entities/chat';
import type { GetOrCreateChatInputDTO } from '../../api/dtos/get-or-create-chat';
import type { CreateGroupChatDTO } from '../../api/dtos/create-group-chat';
import type { AddUsersToGroupInputDTO } from '../../api/dtos/add-users-to-group';
import type { RemoveUsersFromGroupInputDTO } from '../../api/dtos/remove-users-from-group';
import type { UpdateGroupInfoInputDTO } from '../../api/dtos/update-group-info';
import type { UpdateGroupAdminsInputDTO } from '../../api/dtos/update-group-admins';

const KEYS = buildKeys<{
    chats: void;
    detail: string;
}>('chat');

export const CHAT_QUERY_KEYS = {
    chats: KEYS.chats,
    detail: KEYS.detail
} as const;

export const useGetOrCreateChatMutation = createMutation<Chat, GetOrCreateChatInputDTO>(chatService.getOrCreate);
export const useCreateGroupMutation = createMutation<Chat, CreateGroupChatDTO>(chatService.createGroup);
export const useAddUsersToGroupMutation = createMutation<Chat, AddUsersToGroupInputDTO>(chatService.addUsersToGroup);
export const useRemoveUsersFromGroupMutation = createMutation<Chat, RemoveUsersFromGroupInputDTO>(chatService.removeUsersFromGroup);
export const useUpdateGroupInfoMutation = createMutation<Chat, UpdateGroupInfoInputDTO>(chatService.updateGroupInfo);
export const useUpdateGroupAdminsMutation = createMutation<Chat, UpdateGroupAdminsInputDTO>(chatService.updateGroupAdmins);
export const useLeaveGroupMutation = createMutation<void, { chatId: string }>(chatService.leaveGroup);

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

        return current.map((existingChat) => existingChat._id === chat._id ? chat : existingChat);
    });

    setChatDetailCache(queryClient, chat);
};

export const updateChatInCache = (queryClient: QueryClient, chatId: string, updates: Partial<Chat>) => {
    queryClient.setQueryData<Chat[]>(KEYS.chats(), (current) => {
        if (!current) return current;

        return current.map((chat) => chat._id === chatId ? { ...chat, ...updates } : chat);
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
