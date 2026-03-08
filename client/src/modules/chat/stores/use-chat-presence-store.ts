import { create } from 'zustand';
import type { TypingUser } from '../api/entities/chat-events';

type Presence = 'online' | 'offline';

interface ChatPresenceState {
    typingUsers: TypingUser[];
    userPresence: Record<string, Presence>;
};

interface ChatPresenceActions {
    setTypingUser: (typing: TypingUser) => void;
    clearTypingUser: (chatId: string, userId: string) => void;
    setUserPresence: (userId: string, presence: Presence) => void;
    setUsersPresence: (presenceMap: Record<string, Presence>) => void;
    reset: () => void;
};

type ChatPresenceStore = ChatPresenceState & ChatPresenceActions;

const initialState: ChatPresenceState = {
    typingUsers: [],
    userPresence: {}
};

export const useChatPresenceStore = create<ChatPresenceStore>((set) => ({
    ...initialState,

    setTypingUser: (typing) => set((state) => {
        const filtered = state.typingUsers.filter(
            (t) => !(t.chatId === typing.chatId && t.userId === typing.userId)
        );
        if (typing.isTyping) {
            return { typingUsers: [...filtered, typing] };
        }
        return { typingUsers: filtered };
    }),

    clearTypingUser: (chatId, userId) => set((state) => ({
        typingUsers: state.typingUsers.filter(
            (t) => !(t.chatId === chatId && t.userId === userId)
        )
    })),

    setUserPresence: (userId, presence) => set((state) => ({
        userPresence: { ...state.userPresence, [userId]: presence }
    })),

    setUsersPresence: (presenceMap) => set((state) => ({
        userPresence: { ...state.userPresence, ...presenceMap }
    })),

    reset: () => set(initialState)
}));
