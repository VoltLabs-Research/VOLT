import api from '@/api';
import type { ApiResponse } from '@/types/api';

import type { Notification } from '@/types/models';

interface GetNotificationsParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

const notificationApi = {
    async getAll(params?: GetNotificationsParams): Promise<Notification[]>{
        const response = await api.get<ApiResponse<Notification[]>>('/notifications', { params });
        return response.data.data;
    },

    async markAsRead(id: string): Promise<void>{
        await api.patch(`/notifications/${id}`, { read: true });
    }
};

export default notificationApi;
