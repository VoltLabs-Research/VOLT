import VoltClient from '@/api';
import type { ApiResponse } from '@/types/api';
import type { Notification } from '@/types/models';
import type { GetNotificationsParams } from './types';

const client = new VoltClient('/notifications');

export default {
    async getAll(params?: GetNotificationsParams): Promise<Notification[]>{
        const response = await client.request<ApiResponse<Notification[]>>('get', '/', { config: { params } });
        return response.data.data;
    },

    async markAsRead(id: string): Promise<void>{
        await client.request('patch', `/${id}`, { data: { read: true } });
    },

    async markAllAsRead(): Promise<void>{
        await client.request('patch', '/read-all');
    }
};