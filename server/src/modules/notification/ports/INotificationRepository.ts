import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type Notification from '@modules/notification/entities/Notification';
import type { NotificationProps } from '@modules/notification/entities/Notification';

export interface INotificationRepository extends IBaseRepository<Notification, NotificationProps> {
    markAllAsRead(userId: string): Promise<void>;
}
