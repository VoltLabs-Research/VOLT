import type { TypingUser } from '@/types/chat';
import { socketService } from '@/services/websockets/socketio';
import type { SliceCreator } from '@/stores/helpers/create-slice';

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

const emitSocket = (event: string, data: any) => {
    if (socketService.isConnected()) socketService.emit(event, data).catch(() => { });
};

export const createChatSocketSlice: SliceCreator<ChatSocketSlice, any> = (set, get) => ({
    ...initialSocketState,
    setTypingUsers: (users) => set({ typingUsers: users }),
    setUserPresence: (userId, status) => set((s: any) => ({ userPresence: { ...s.userPresence, [userId]: status } })),
    setUsersPresence: (data) => set((s: any) => ({ userPresence: { ...s.userPresence, ...data } })),
    getUserPresence: (userId) => (get() as any).userPresence[userId] || 'offline',
    joinChat: (chatId) => emitSocket('join_chat', chatId),
    leaveChat: (chatId) => emitSocket('leave_chat', chatId),
    startTyping: (chatId) => emitSocket('typing_start', { chatId }),
    stopTyping: (chatId) => emitSocket('typing_stop', { chatId }),
    fetchUsersPresence: (userIds) => emitSocket('get_users_presence', { userIds })
});
