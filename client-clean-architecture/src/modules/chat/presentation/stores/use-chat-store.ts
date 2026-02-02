import { create } from 'zustand';
import type { Chat } from '@/modules/chat/domain/entities';

interface ChatStore {
    chats: Chat[];
    isLoading: boolean;
    setChats: (chats: Chat[]) => void;
    addChat: (chat: Chat) => void;
    updateChat: (id: string, updates: Partial<Chat>) => void;
    removeChat: (id: string) => void;
    setLoading: (isLoading: boolean) => void;
    reset: () => void;
};

const initialState = { chats: [] as Chat[], isLoading: false };

export const useChatStore = create<ChatStore>((set) => ({
    ...initialState,
    setChats: (chats) => set({ chats }),
    addChat: (chat) => set((s) => s.chats.some((c) => c._id === chat._id) ? s : { chats: [chat, ...s.chats] }),
    updateChat: (id, updates) => set((s) => ({ 
        chats: s.chats.map((c) => c._id === id ? { ...c, ...updates } : c) 
    })),
    removeChat: (id) => set((s) => ({ chats: s.chats.filter((c) => c._id !== id) })),
    setLoading: (isLoading) => set({ isLoading }),
    reset: () => set(initialState)
}));
