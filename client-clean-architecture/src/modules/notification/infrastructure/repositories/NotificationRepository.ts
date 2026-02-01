import { injectable } from 'tsyringe';
import BaseRepository, { RawPaginatedResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type INotificationRepository from '../../domain/ports/INotificationRepository';
import type { GetNotificationsParams } from '../../domain/ports/INotificationRepository';
import type { Notification } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class NotificationRepository extends BaseRepository implements INotificationRepository {
    constructor() {
        super('/notification', { useRBAC: false });
    }

    async getAll(params?: GetNotificationsParams): Promise<PaginatedResponse<Notification>> {
        const response = await this.client.get<RawPaginatedResponse<Notification>>('/', params);
        return this.unwrapPaginated(response);
    }

    async markAllAsRead(): Promise<void> {
        await this.client.patch('/read-all');
    }
};
