import { create } from 'zustand';
import type { ChatMessage } from '@/modules/chat/domain/entities';
import { deduplicateById } from '@/shared/domain/utils/deduplicateById';
import {
    createBaseSlice, BASE_SLICE_INITIAL_STATE,
    type BaseSlice
} from '@/shared/presentation/stores/create-base-store-slice';

interface ChatMessageState {
    messages: ChatMessage[];
};

interface ChatMessageActions {
    setMessages: (messages: ChatMessage[]) => void;
    appendMessages: (messages: ChatMessage[]) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
    removeMessage: (messageId: string) => void;
    reset: () => void;
};

type ChatMessageStore = ChatMessageState & ChatMessageActions & BaseSlice & {
    hasMore: boolean;
    page: number;
    setHasMore: (hasMore: boolean) => void;
    setPage: (page: number) => void;
};

const initialState: ChatMessageState & typeof BASE_SLICE_INITIAL_STATE = {
    messages: [],
    ...BASE_SLICE_INITIAL_STATE
};

const paginationInitialState = {
    hasMore: true,
    page: 1
};

const resetState = {
    ...initialState,
    ...paginationInitialState
};

export const useChatMessageStore = create<ChatMessageStore>((set) => ({
    ...resetState,
    ...createBaseSlice(set),
    setHasMore: (hasMore) => set({ hasMore }),
    setPage: (page) => set({ page }),

    setMessages: (messages) => set({ messages }),

    appendMessages: (newMessages) => set((state) => ({
        messages: deduplicateById(state.messages, newMessages)
    })),

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

    reset: () => set(resetState)
}));
