import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { Notification } from '../../domain/entities/Notification';
import { NotificationService } from '../../domain/services/NotificationService';
import { getNotificationUseCases } from '../../application/registry';
import type { NotificationUseCases } from '../../application/registry';
import { notificationRepository } from '../../infrastructure/repositories/NotificationRepository';

export interface NotificationState {
    notifications: Notification[];
    loading: boolean;
    error: string | null;
    unreadCount: number;
}

export interface NotificationActions {
    fetchNotifications: () => Promise<void>;
    markNotificationAsRead: (id: string) => Promise<void>;
    markAllNotificationsAsRead: () => Promise<void>;
    addNotification: (notification: Notification) => void;
    initializeNotificationSocket: () => () => void;
}

export type NotificationSlice = NotificationState & NotificationActions;

export const initialState: NotificationState = {
    notifications: [],
    loading: false,
    error: null,
    unreadCount: 0
};

const resolveUseCases = (): NotificationUseCases => getNotificationUseCases();
const notificationService = new NotificationService();

export const createNotificationSlice: SliceCreator<NotificationSlice> = (set, get) => ({
    ...initialState,

    fetchNotifications: async () => {
        const state = get();
        if (state.notifications.length > 0) return;

        await runRequest(set, get, () => notificationRepository.getNotifications(), {
            loadingKey: 'loading',
            errorFallback: 'Failed to load notifications',
            onSuccess: (notifications) => {
                const unreadCount = notificationService.countUnread(notifications);
                set({ notifications, unreadCount });
            }
        });
    },

    markNotificationAsRead: async (notificationId: string) => {
        await runRequest(set, get, () => notificationRepository.markAsRead(notificationId), {
            skipLoading: true,
            onSuccess: () => {
                set((state: NotificationSlice) => {
                    const notifications = notificationService.markAsRead(state.notifications, notificationId);
                    const unreadCount = notificationService.countUnread(notifications);
                    return { notifications, unreadCount };
                });
            }
        });
    },

    markAllNotificationsAsRead: async () => {
        await runRequest(set, get, () => notificationRepository.markAllAsRead(), {
            skipLoading: true,
            onSuccess: () => {
                set((state: NotificationSlice) => ({
                    notifications: notificationService.markAllAsRead(state.notifications),
                    unreadCount: 0
                }));
            }
        });
    },

    addNotification: (notification: Notification) => {
        set((state: NotificationSlice) => {
            const notifications = notificationService.mergeNotification(state.notifications, notification);
            if (notifications === state.notifications) return state;
            const unreadCount = notificationService.countUnread(notifications);
            return {
                notifications,
                unreadCount
            };
        });
    },

    initializeNotificationSocket: () => {
        const { initializeNotificationSocketUseCase } = resolveUseCases();
        return initializeNotificationSocketUseCase.execute({
            onNotification: (notification) => {
                get().addNotification(notification);
            },
            onConnectError: (error) => {
                console.error('[NotificationStore] Socket connection error:', error);
            }
        });
    }
});
