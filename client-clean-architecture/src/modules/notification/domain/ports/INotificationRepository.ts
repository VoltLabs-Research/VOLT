import type { Notification } from '../entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface GetNotificationsParams {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
};

export default interface INotificationRepository {
    getAll(params?: GetNotificationsParams): Promise<PaginatedResponse<Notification>>;
    markAllAsRead(): Promise<void>;
};
