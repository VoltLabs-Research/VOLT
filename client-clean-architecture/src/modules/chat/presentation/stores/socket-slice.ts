import type { TypingUser } from '../../domain/entities';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import { getChatUseCases } from '../../application/registry';
import type { ChatUseCases } from '../../application/registry';

export interface ChatSocketState {
    typingUsers: TypingUser[];
    userPresence: { [userId: string]: 'online' | 'offline' };
}

export interface ChatSocketActions {
    setTypingUsers: (users: TypingUser[]) => void;
    setUserPresence: (userId: string, status: 'online' | 'offline') => void;
    setUsersPresence: (data: Record<string, 'online' | 'offline'>) => void;
    getUserPresence: (userId: string) => 'online' | 'offline' | undefined;
    joinChat: (chatId: string) => void;
    leaveChat: (chatId: string) => void;
    startTyping: (chatId: string) => void;
    stopTyping: (chatId: string) => void;
    fetchUsersPresence: (userIds: string[]) => void;
}

export type ChatSocketSlice = ChatSocketState & ChatSocketActions;

export const initialSocketState: ChatSocketState = {
    typingUsers: [],
    userPresence: {}
};

const resolveUseCases = (): ChatUseCases => getChatUseCases();

export const createChatSocketSlice: SliceCreator<ChatSocketSlice> = (set, get) => ({
    ...initialSocketState,
    setTypingUsers: (users) => set({ typingUsers: users }),
    setUserPresence: (userId, status) => set((s: any) => ({ userPresence: { ...s.userPresence, [userId]: status } })),
    setUsersPresence: (data) => set((s: any) => ({ userPresence: { ...s.userPresence, ...data } })),
    getUserPresence: (userId) => get().userPresence[userId] || 'offline',
    joinChat: (chatId) => {
        const { chatSocketUseCase } = resolveUseCases();
        chatSocketUseCase.joinChat(chatId);
    },
    leaveChat: (chatId) => {
        const { chatSocketUseCase } = resolveUseCases();
        chatSocketUseCase.leaveChat(chatId);
    },
    startTyping: (chatId) => {
        const { chatSocketUseCase } = resolveUseCases();
        chatSocketUseCase.startTyping(chatId);
    },
    stopTyping: (chatId) => {
        const { chatSocketUseCase } = resolveUseCases();
        chatSocketUseCase.stopTyping(chatId);
    },
    fetchUsersPresence: (userIds) => {
        const { chatSocketUseCase } = resolveUseCases();
        chatSocketUseCase.fetchUsersPresence(userIds);
    }
});
