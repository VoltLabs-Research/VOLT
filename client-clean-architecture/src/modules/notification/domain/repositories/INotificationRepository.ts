import type { Notification } from '../entities';
import type { GetNotificationsParams } from '@/modules/notification/domain/types';

export interface INotificationRepository {
    getNotifications(params?: GetNotificationsParams): Promise<Notification[]>;
    markAsRead(id: string): Promise<void>;
    markAllAsRead(): Promise<void>;
}
