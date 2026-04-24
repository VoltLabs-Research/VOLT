import { PresenceStatus } from '../../api/entities/shared/chat-events';
import { create } from 'zustand';
import type { TypingUser } from '../../api/entities/shared/chat-events';

type Presence = PresenceStatus.Online | PresenceStatus.Offline;

interface ChatPresenceState {
    typingUsers: TypingUser[];
    userPresence: Record<string, Presence>;
};

interface ChatPresenceActions {
    setTypingUser: (typing: TypingUser) => void;
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

    setUsersPresence: (presenceMap) => set((state) => ({
        userPresence: { ...state.userPresence, ...presenceMap }
    })),

    reset: () => set(initialState)
}));
