import { create } from 'zustand';
import type { ChatMessage } from '@/modules/chat/domain/entities';

interface ChatMessageState {
    messages: ChatMessage[];
    isLoading: boolean;
    hasMore: boolean;
    page: number;
};

interface ChatMessageActions {
    setMessages: (messages: ChatMessage[]) => void;
    appendMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
    removeMessage: (messageId: string) => void;
    setLoading: (isLoading: boolean) => void;
    setHasMore: (hasMore: boolean) => void;
    setPage: (page: number) => void;
    reset: () => void;
};

type ChatMessageStore = ChatMessageState & ChatMessageActions;

const initialState: ChatMessageState = {
    messages: [],
    isLoading: false,
    hasMore: true,
    page: 1
};

export const useChatMessageStore = create<ChatMessageStore>((set) => ({
    ...initialState,

    setMessages: (messages) => set({ messages }),

    appendMessages: (newMessages) => set((state) => {
        const existingIds = new Set(state.messages.map((m) => m._id));
        const uniqueNew = newMessages.filter((m) => !existingIds.has(m._id));
        return { messages: [...state.messages, ...uniqueNew] };
    }),

    addMessage: (message) => set((state) => {
        if (state.messages.some((m) => m._id === message._id)) return state;
        return { messages: [...state.messages, message] };
    }),

    updateMessage: (messageId, updates) => set((state) => ({
        messages: state.messages.map((m) =>
            m._id === messageId ? { ...m, ...updates } : m
        )
    })),

    removeMessage: (messageId) => set((state) => ({
        messages: state.messages.filter((m) => m._id !== messageId)
    })),

    setLoading: (isLoading) => set({ isLoading }),

    setHasMore: (hasMore) => set({ hasMore }),

    setPage: (page) => set({ page }),

    reset: () => set(initialState)
}));
