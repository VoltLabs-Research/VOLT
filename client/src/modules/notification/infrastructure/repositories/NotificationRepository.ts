import { injectable } from 'tsyringe';
import BaseRepository from '@/shared/infrastructure/repositories/BaseRepository';
import type INotificationRepository from '../../domain/port/INotificationRepository';
import type { GetNotificationsParams } from '../../domain/port/INotificationRepository';
import type { Notification } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class NotificationRepository extends BaseRepository implements INotificationRepository {
    constructor() {
        super('/notification', { useRBAC: false });
    }

    async getAll(params?: GetNotificationsParams): Promise<PaginatedResponse<Notification>> {
        return this.getAllPaginated('/', params);
    }

    async markAllAsRead(): Promise<void> {
        await this.client.patch('/read-all');
    }
};
