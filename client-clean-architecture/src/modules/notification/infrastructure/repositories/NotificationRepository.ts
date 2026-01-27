import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import type { INotificationRepository } from '../../domain/repositories/INotificationRepository';
import type { Notification } from '../../domain/entities/Notification';
import type { GetNotificationsParams } from '@/modules/notification/domain/types';

export class NotificationRepository extends BaseRepository implements INotificationRepository {
    constructor() {
        super('/notification');
    }

    async getNotifications(params?: GetNotificationsParams): Promise<Notification[]> {
        return this.get<Notification[]>('/', { config: { params } });
    }

    async markAsRead(id: string): Promise<void> {
        await this.patch(`/${id}`, { read: true });
    }

    async markAllAsRead(): Promise<void> {
        await this.patch('/read-all');
    }
}

export const notificationRepository = new NotificationRepository();
