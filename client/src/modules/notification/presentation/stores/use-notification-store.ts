import { create } from 'zustand';
import type { Notification } from '@/modules/notification/domain/entities';
import { deduplicateById } from '@/shared/domain/utils/deduplicateById';
import {
    createBaseSlice, BASE_SLICE_INITIAL_STATE,
    type BaseSlice
} from '@/shared/presentation/stores/create-base-store-slice';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
};

interface NotificationActions {
    setNotifications: (notifications: Notification[]) => void;
    appendNotifications: (notifications: Notification[]) => void;
    addNotification: (notification: Notification) => void;
    markAllAsRead: () => void;
    reset: () => void;
};

type NotificationStore = NotificationState & NotificationActions & BaseSlice & {
    hasMore: boolean;
    page: number;
    setHasMore: (hasMore: boolean) => void;
    setPage: (page: number) => void;
};

const initialState: NotificationState & typeof BASE_SLICE_INITIAL_STATE = {
    notifications: [],
    unreadCount: 0,
    ...BASE_SLICE_INITIAL_STATE
};

const countUnread = (notifications: Notification[]): number => {
    return notifications.filter((n) => !n.read).length;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
    ...initialState,
    ...createBaseSlice(set),
    hasMore: true,
    page: 1,
    setHasMore: (hasMore) => set({ hasMore }),
    setPage: (page) => set({ page }),

    setNotifications: (notifications) => {
        set({ 
            notifications, 
            unreadCount: countUnread(notifications) 
        });
    },

    appendNotifications: (newNotifications) => {
        set((state) => {
            const combined = deduplicateById(state.notifications, newNotifications);
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

    reset: () => set(initialState)
}));
