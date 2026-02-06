import { create } from 'zustand';
import type { Notification } from '@/modules/notification/domain/entities';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    hasMore: boolean;
    page: number;
    error: string | null;
};

interface NotificationActions {
    setNotifications: (notifications: Notification[]) => void;
    appendNotifications: (notifications: Notification[]) => void;
    addNotification: (notification: Notification) => void;
    markAllAsRead: () => void;
    setLoading: (isLoading: boolean) => void;
    setHasMore: (hasMore: boolean) => void;
    setPage: (page: number) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type NotificationStore = NotificationState & NotificationActions;

const initialState: NotificationState = {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    hasMore: true,
    page: 1,
    error: null
};

const countUnread = (notifications: Notification[]): number => {
    return notifications.filter((n) => !n.read).length;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
    ...initialState,

    setNotifications: (notifications) => {
        set({ 
            notifications, 
            unreadCount: countUnread(notifications) 
        });
    },

    appendNotifications: (newNotifications) => {
        set((state) => {
            const existingIds = new Set(state.notifications.map((n) => n._id));
            const uniqueNew = newNotifications.filter((n) => !existingIds.has(n._id));
            const combined = [...state.notifications, ...uniqueNew];
            return {
                notifications: combined,
                unreadCount: countUnread(combined)
            };
        });
    },

    addNotification: (notification) => {
        set((state) => {
            if(state.notifications.some((n) => n._id === notification._id)){
                return state;
            }

            const shouldIncrementUnread = !notification.read;
            return {
                notifications: [notification, ...state.notifications],
                unreadCount: state.unreadCount + (shouldIncrementUnread ? 1 : 0)
            };
        });
    },

    markAllAsRead: () => {
        set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0
        }));
    },

    setLoading: (isLoading) => set({ isLoading }),

    setHasMore: (hasMore) => set({ hasMore }),

    setPage: (page) => set({ page }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));
