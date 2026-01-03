import type { Chat, Message } from '@/types/chat';
import type { User } from '@/types/models';
import { chatApi } from '@/services/api/chat/chat';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';
import { socketService } from '@/services/websockets/socketio';

export interface ChatDataState {
    chats: Chat[];
    currentChat: Chat | null;
    messages: Message[];
    teamMembers: User[];
    isLoading: boolean;
    isLoadingMessages: boolean;
    isLoadingChats: boolean;
    isConnected: boolean;
}

export interface ChatDataActions {
    setCurrentChat: (chat: Chat | null) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    updateMessage: (messageId: string, updates: Partial<Message>) => void;
    setLoading: (loading: boolean) => void;
    setLoadingMessages: (loading: boolean) => void;
    setLoadingChats: (loading: boolean) => void;
    setConnected: (connected: boolean) => void;
    loadChats: () => Promise<void>;
    loadTeamMembers: (teamId: string) => Promise<void>;
    loadMessages: (chatId: string) => Promise<void>;
    sendMessage: (content: string, messageType?: string, metadata?: any) => Promise<void>;
    sendFileMessage: (file: File) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    toggleReaction: (messageId: string, emoji: string) => Promise<void>;
    markAsRead: (chatId: string) => Promise<void>;
    getOrCreateChat: (teamId: string, participantId: string) => Promise<Chat>;
    createGroupChat: (teamId: string, groupName: string, groupDescription: string, participantIds: string[]) => Promise<void>;
    addUsersToGroup: (chatId: string, userIds: string[]) => Promise<void>;
    removeUsersFromGroup: (chatId: string, userIds: string[]) => Promise<void>;
    updateGroupInfo: (chatId: string, groupName?: string, groupDescription?: string) => Promise<void>;
    updateGroupAdmins: (chatId: string, userIds: string[], action: 'add' | 'remove') => Promise<void>;
    leaveGroup: (chatId: string) => Promise<void>;
}

export type ChatDataSlice = ChatDataState & ChatDataActions;

export const initialDataState: ChatDataState = {
    chats: [],
    currentChat: null,
    messages: [],
    teamMembers: [],
    isLoading: false,
    isLoadingMessages: false,
    isLoadingChats: false,
    isConnected: false
};

// Track which team's members have been loaded
let loadedTeamMembersForTeam: string | null = null;

const emitSocket = (event: string, data: any) => {
    if (socketService.isConnected()) socketService.emit(event, data).catch(() => { });
};

const updateChat = (set: any, chatId: string, updatedChat: Chat) => {
    set((s: any) => ({
        chats: s.chats.map((c: Chat) => c._id === chatId ? updatedChat : c),
        currentChat: s.currentChat?._id === chatId ? updatedChat : s.currentChat
    }));
};

export const createChatDataSlice: SliceCreator<ChatDataSlice, any> = (set, get) => ({
    ...initialDataState,

    setCurrentChat: (chat) => set({ currentChat: chat }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((s: any) => ({ messages: [...s.messages, message] })),
    updateMessage: (messageId, updates) => set((s: any) => ({ messages: s.messages.map((m: Message) => m._id === messageId ? { ...m, ...updates } : m) })),
    setLoading: (loading) => set({ isLoading: loading }),
    setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
    setLoadingChats: (loading) => set({ isLoadingChats: loading }),
    setConnected: (connected) => set({ isConnected: connected }),

    loadChats: async () => {
        const state = get();
        // Skip if already have chats
        if (state.chats.length > 0) return;

        await runRequest(set, get, () => chatApi.getChats(), {
            loadingKey: 'isLoadingChats',
            errorFallback: 'Failed to load chats',
            onSuccess: (chats) => set({ chats })
        });
    },

    loadTeamMembers: async (teamId) => {
        // Skip if already loaded for this team
        if (loadedTeamMembersForTeam === teamId) return;

        await runRequest(set, get, () => chatApi.getTeamMembers(teamId), {
            skipLoading: true,
            onSuccess: (members) => {
                loadedTeamMembersForTeam = teamId;
                set({ teamMembers: members });
            }
        });
    },

    loadMessages: async (chatId) => {
        await runRequest(set, get, () => chatApi.getChatMessages(chatId), {
            loadingKey: 'isLoadingMessages',
            errorFallback: 'Failed to load messages',
            onSuccess: (messages) => set({ messages })
        });
    },

    sendMessage: async (content, messageType = 'text', metadata) => {
        const chat = (get() as any).currentChat;
        if (chat) emitSocket('send_message', { chatId: chat._id, content, messageType, metadata });
    },

    sendFileMessage: async (file) => {
        const chat = (get() as any).currentChat;
        if (!chat) return;
        await runRequest(set, get, () => chatApi.uploadFile(chat._id, file), {
            skipLoading: true,
            onSuccess: (fileData) => emitSocket('send_file_message', { chatId: chat._id, ...fileData })
        });
    },

    editMessage: async (messageId, content) => {
        const chat = (get() as any).currentChat;
        if (!chat) return;
        await runRequest(set, get, () => chatApi.editMessage(chat._id, messageId, content), {
            skipLoading: true,
            onSuccess: (updated) => {
                set((s: any) => ({ messages: s.messages.map((m: Message) => m._id === messageId ? updated : m) }));
                emitSocket('edit_message', { chatId: chat._id, messageId, content });
            }
        });
    },

    deleteMessage: async (messageId) => {
        const chat = (get() as any).currentChat;
        const msgs = (get() as any).messages;
        if (!chat) return;
        const orig = msgs.find((m: Message) => m._id === messageId);
        if (!orig) return;

        set((s: any) => ({ messages: s.messages.map((m: Message) => m._id === messageId ? { ...m, deleted: true } : m) }));
        await runRequest(set, get, () => chatApi.deleteMessage(chat._id, messageId), {
            skipLoading: true,
            successMessage: 'Message deleted successfully',
            onSuccess: () => emitSocket('delete_message', { chatId: chat._id, messageId }),
            onError: () => set((s: any) => ({ messages: s.messages.map((m: Message) => m._id === messageId ? orig : m) }))
        });
    },

    toggleReaction: async (messageId, emoji) => {
        const chat = (get() as any).currentChat;
        if (chat) emitSocket('toggle_reaction', { chatId: chat._id, messageId, emoji });
    },

    markAsRead: async (chatId) => {
        await runRequest(set, get, () => chatApi.markMessagesAsRead(chatId), { skipLoading: true });
    },

    getOrCreateChat: (teamId, participantId) => chatApi.getOrCreateChat(teamId, participantId),

    createGroupChat: async (teamId, groupName, groupDescription, participantIds) => {
        await runRequest(set, get, () => chatApi.createGroupChat(teamId, groupName, groupDescription, participantIds), {
            skipLoading: true,
            successMessage: 'Group chat created successfully',
            onSuccess: (chat) => {
                set((s: any) => ({ chats: [...s.chats, chat] }));
                emitSocket('group_created', { chatId: chat._id });
            }
        });
    },

    addUsersToGroup: async (chatId, userIds) => {
        await runRequest(set, get, () => chatApi.addUsersToGroup(chatId, userIds), {
            skipLoading: true,
            successMessage: 'Users added to group successfully',
            onSuccess: (chat) => { updateChat(set, chatId, chat); emitSocket('users_added_to_group', { chatId, userIds }); }
        });
    },

    removeUsersFromGroup: async (chatId, userIds) => {
        await runRequest(set, get, () => chatApi.removeUsersFromGroup(chatId, userIds), {
            skipLoading: true,
            successMessage: 'Users removed from group successfully',
            onSuccess: (chat) => { updateChat(set, chatId, chat); emitSocket('users_removed_from_group', { chatId, userIds }); }
        });
    },

    updateGroupInfo: async (chatId, groupName, groupDescription) => {
        await runRequest(set, get, () => chatApi.updateGroupInfo(chatId, groupName, groupDescription), {
            skipLoading: true,
            successMessage: 'Group info updated successfully',
            onSuccess: (chat) => { updateChat(set, chatId, chat); emitSocket('group_info_updated', { chatId, groupName, groupDescription }); }
        });
    },

    updateGroupAdmins: async (chatId, userIds, action) => {
        await runRequest(set, get, () => chatApi.updateGroupAdmins(chatId, userIds, action), {
            skipLoading: true,
            successMessage: `Group admins ${action === 'add' ? 'added' : 'removed'} successfully`,
            onSuccess: (chat) => updateChat(set, chatId, chat)
        });
    },

    leaveGroup: async (chatId) => {
        await runRequest(set, get, () => chatApi.leaveGroup(chatId), {
            skipLoading: true,
            successMessage: 'Left group successfully',
            onSuccess: () => {
                set((s: any) => ({ chats: s.chats.filter((c: Chat) => c._id !== chatId), currentChat: s.currentChat?._id === chatId ? null : s.currentChat }));
                emitSocket('user_left_group', { chatId });
            }
        });
    }
});
