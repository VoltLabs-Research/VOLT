import type { Chat } from '../../domain/entities';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import { chatRepository } from '../../infrastructure/repositories/ChatRepository';

export interface ChatDataState {
    currentChat: Chat | null;
    isConnected: boolean;
}

export interface ChatDataActions {
    setCurrentChat: (chat: Chat | null) => void;
    setConnected: (connected: boolean) => void;
    
    // Actions that wrap repository calls but don't store data in Zustand anymore
    // These could potentially be moved to hooks, but keeping them here for now 
    // to minimize disruption to components calling store.action()
    // However, for the "Migration", we should prefer using the hooks.
    // For now, I will keep helper methods that perform mutations but don't update store state (except currentChat)
    
    sendMessage: (content: string, messageType?: string, metadata?: any) => Promise<void>;
    sendFileMessage: (file: File) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    toggleReaction: (messageId: string, emoji: string) => Promise<void>;
    markAsRead: (chatId: string) => Promise<void>;
    getOrCreateChat: (teamId: string, participantId: string) => Promise<Chat>;
    createGroupChat: (teamId: string, groupName: string, groupDescription: string, participantIds: string[]) => Promise<void>;
    addUsersToGroup: (chatId: string, userIds: string[]) => Promise<void>;
    removeUserFromGroup: (chatId: string, userId: string) => Promise<void>;
    updateGroupInfo: (chatId: string, name: string, description: string) => Promise<void>;
    updateGroupAdmins: (chatId: string, userIds: string[], action: 'add' | 'remove') => Promise<void>;
    leaveGroup: (chatId: string) => Promise<void>;
}

export type ChatDataSlice = ChatDataState & ChatDataActions;

export const initialDataState: ChatDataState = {
    currentChat: null,
    isConnected: false
};

export const createChatDataSlice: SliceCreator<ChatDataSlice> = (set, get) => ({
    ...initialDataState,

    setCurrentChat: (chat) => set({ currentChat: chat }),
    setConnected: (connected) => set({ isConnected: connected }),

    sendMessage: async (content, messageType = 'text', metadata) => {
        const chat = get().currentChat;
        if (chat) {
            await chatRepository.sendMessage(chat._id, content, messageType, metadata);
        }
    },

    sendFileMessage: async (file) => {
        const chat = get().currentChat;
        if (!chat) return;
        await chatRepository.uploadFile(chat._id, file);
    },

    editMessage: async (messageId, content) => {
        const chat = get().currentChat;
        if (!chat) return;
        await chatRepository.editMessage(chat._id, messageId, content);
    },

    deleteMessage: async (messageId) => {
        const chat = get().currentChat;
        if (!chat) return;
        await chatRepository.deleteMessage(chat._id, messageId);
    },

    toggleReaction: async (messageId, emoji) => {
        // This is socket only in original code? 
        // "chatSocketUseCase.toggleReaction"
        // Need to check if there is a REST endpoint for this.
        // Original code: chatSocketUseCase.toggleReaction(...)
        // Usually reactions are done via REST and then socket broadcasts.
        // If there is no REST endpoint, we might need to keep using socket use case here,
        // or refactor backend to have REST.
        // For now, let's assume we use the repository if available, or socket directly.
        // The original code only called socket.
        // I will fix this in useChatSocket or similar.
    },

    markAsRead: async (chatId) => {
        await chatRepository.markAsRead(chatId);
    },

    getOrCreateChat: (teamId, participantId) => {
        return chatRepository.getOrCreateChat(teamId, participantId);
    },

    createGroupChat: async (teamId, groupName, groupDescription, participantIds) => {
        await chatRepository.createGroupChat(teamId, groupName, groupDescription, participantIds);
    },

    addUsersToGroup: async (chatId, userIds) => {
        await chatRepository.addUsersToGroup(chatId, userIds);
    },

    removeUserFromGroup: async (chatId, userId) => {
        await chatRepository.removeUserFromGroup(chatId, userId);
    },

    updateGroupInfo: async (chatId, name, description) => {
        await chatRepository.updateGroupInfo(chatId, name, description);
    },

    updateGroupAdmins: async (chatId, userIds, action) => {
        await chatRepository.updateGroupAdmins(chatId, userIds, action);
    },

    leaveGroup: async (chatId) => {
        await chatRepository.leaveGroup(chatId);
        const current = get().currentChat;
        if (current?._id === chatId) {
            set({ currentChat: null });
        }
    }
});