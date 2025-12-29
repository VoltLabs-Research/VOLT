import type { Notification } from '@/types/models';
import notificationsApi from '@/services/api/notification/notification';
import { socketService } from '@/services/websockets/socketio';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

export interface NotificationState {
    notifications: Notification[];
    loading: boolean;
    error: string | null;
    unreadCount: number;
}

export interface NotificationActions {
    fetch: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addNotification: (notification: Notification) => void;
    initializeSocket: () => () => void;
}

export type NotificationSlice = NotificationState & NotificationActions;

const calcUnread = (n: Notification[]) => n.filter(x => !x.read).length;

export const initialState: NotificationState = {
    notifications: [],
    loading: false,
    error: null,
    unreadCount: 0
};

export const createNotificationSlice: SliceCreator<NotificationSlice> = (set, get) => ({
    ...initialState,

    fetch: async () => {
        await runRequest(set, get, () => notificationsApi.getAll(), {
            errorFallback: 'Failed to load notifications',
            loadingKey: 'loading',
            onSuccess: (n) => set({ notifications: n, unreadCount: calcUnread(n) } as Partial<NotificationSlice>)
        });
    },

    markAsRead: async (id) => {
        await runRequest(set, get, () => notificationsApi.markAsRead(id), {
            skipLoading: true,
            onSuccess: () => set((s: NotificationSlice) => {
                const updated = s.notifications.map(n => n._id === id ? { ...n, read: true } : n);
                return { notifications: updated, unreadCount: calcUnread(updated) };
            })
        });
    },

    markAllAsRead: async () => {
        await runRequest(set, get, () => notificationsApi.markAllAsRead(), {
            skipLoading: true,
            onSuccess: () => set((s: NotificationSlice) => ({
                notifications: s.notifications.map(n => ({ ...n, read: true })),
                unreadCount: 0
            }))
        });
    },

    addNotification: (n) => set((s: NotificationSlice) => ({
        notifications: [n, ...s.notifications],
        unreadCount: s.unreadCount + (n.read ? 0 : 1)
    })),

    initializeSocket: () => {
        const off = socketService.on('notification', (n: Notification) => (get() as NotificationSlice).addNotification(n));
        return () => off();
    }
});
