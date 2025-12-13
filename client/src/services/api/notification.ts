import api from '@/api';
import type { ApiResponse } from '@/types/api';

interface Notification {
    _id: string;
    type: string;
    message: string;
    read: boolean;
    createdAt: string;
    [key: string]: any;
}

interface GetNotificationsParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
}

const notificationApi = {
    async getAll(params?: GetNotificationsParams): Promise<Notification[]> {
        const response = await api.get<ApiResponse<Notification[]>>('/notifications', { params });
        return response.data.data;
    }
};

export default notificationApi;
