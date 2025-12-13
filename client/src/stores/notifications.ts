import { create } from 'zustand';
import { socketService } from '@/services/socketio';
import type { Notification } from '@/types/models';
import notificationApi from '@/services/api/notification';

interface NotificationState {
    notifications: Notification[];
    loading: boolean;
    error?: string;
    unreadCount: number;
    fetch: (opts?: { force?: boolean }) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    addNotification: (notification: Notification) => void;
    initializeSocket: () => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    loading: false,
    error: undefined,
    unreadCount: 0,

    fetch: async(opts) => {
        if(get().loading) return;
        if(!opts?.force && get().notifications.length) return;
        set({ loading: true, error: undefined });
        try{
            const notifications = await notificationApi.getAll({ limit: 20 });
            const unreadCount = notifications.filter(n => !n.read).length;
            set({ notifications, unreadCount, loading: false });
        }catch(err: any){
            set({ loading: false, error: err?.message || 'Failed to load notifications' });
        }
    },

    markAsRead: async(id: string) => {
        try{
            await api.patch<ApiResponse<Notification>>(`/notifications/${id}`, { read: true });
            set((s) => ({
                notifications: s.notifications.map(n => n._id === id ? { ...n, read: true } : n),
                unreadCount: Math.max(0, s.unreadCount - 1)
            }));
        }catch(err){ /* noop */ }
    },

    addNotification: (notification: Notification) => {
        set((s) => ({
            notifications: [notification, ...s.notifications],
            unreadCount: s.unreadCount + 1
        }));
    },

    initializeSocket: () => {
        // Listen for new notifications from socket
        const unsubscribe = socketService.on<Notification>('new_notification', (notification) => {
            get().addNotification(notification);
        });

        return unsubscribe;
    }
}));

export default useNotificationStore;
