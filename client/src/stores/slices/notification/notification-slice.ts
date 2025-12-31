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
            loadingKey: 'loading',
            errorFallback: 'Failed to load notifications',
            onSuccess: (notifications: Notification[]) => {
                const unreadCount = notifications.filter((n) => !n.read).length;

                set({
                    notifications,
                    unreadCount
                } as Partial<NotificationSlice>);
            }
        });
    },

    markAsRead: async (notificationId: string) => {
        await runRequest(set, get, () => notificationsApi.markAsRead(notificationId), {
            skipLoading: true,
            onSuccess: () => {
                set((state: NotificationSlice) => {
                    const notifications = state.notifications.map((notification) => {
                        const isTarget = notification._id === notificationId;
                        if (!isTarget) return notification;

                        return {
                            ...notification,
                            read: true
                        };
                    });

                    const unreadCount = notifications.filter((n) => !n.read).length;

                    return {
                        notifications,
                        unreadCount
                    };
                });
            }
        });
    },

    markAllAsRead: async () => {
        await runRequest(set, get, () => notificationsApi.markAllAsRead(), {
            skipLoading: true,
            onSuccess: () => {
                set((state: NotificationSlice) => {
                    const notifications = state.notifications.map((notification) => ({
                        ...notification,
                        read: true
                    }));

                    return {
                        notifications,
                        unreadCount: 0
                    };
                });
            }
        });
    },

    addNotification: (notification: Notification) => {
        set((state: NotificationSlice) => {
            const shouldIncrementUnread = !notification.read;
            const unreadCount = state.unreadCount + (shouldIncrementUnread ? 1 : 0);

            return {
                notifications: [notification, ...state.notifications],
                unreadCount
            };
        });
    },

    initializeSocket: () => {
        const off = socketService.on('notification', (notification: Notification) => {
            const slice = get() as NotificationSlice;
            slice.addNotification(notification);
        });

        return () => {
            off();
        };
    }
});
