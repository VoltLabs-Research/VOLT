import { create } from 'zustand';
import { api } from '@/services/api';
import type { Notification } from '@/types/models';
import type { ApiResponse } from '@/types/api';

interface NotificationState {
    notifications: Notification[];
    loading: boolean;
    error?: string;
    fetch: (opts?: { force?: boolean }) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    loading: false,
    error: undefined,
    fetch: async (opts) => {
        if(get().loading) return;
        if(!opts?.force && get().notifications.length) return;
        set({ loading: true, error: undefined });
        try{
            const res = await api.get<ApiResponse<Notification[]>>('/notifications', {
                params: { sort: '-createdAt', limit: 20 }
            });
            set({ notifications: res.data.data || [], loading: false });
        }catch(err: any){
            set({ loading: false, error: err?.message || 'Failed to load notifications' });
        }
    },
    markAsRead: async (id: string) => {
        try{
            await api.patch<ApiResponse<Notification>>(`/notifications/${id}`, { read: true });
            set((s) => ({ notifications: s.notifications.map(n => n._id === id ? { ...n, read: true } : n) }));
        }catch(err){ /* noop */ }
    }
}));

export default useNotificationStore;
