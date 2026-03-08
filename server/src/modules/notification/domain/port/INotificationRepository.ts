import type { NotificationProps } from '@modules/notification/domain/entities/Notification';
import type Notification from '@modules/notification/domain/entities/Notification';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface INotificationRepository extends IBaseRepository<Notification, NotificationProps>{
    /**
     * Mark all notifications as read for the specified user id.
     */
    markAllAsRead(userId: string): Promise<void>;
};
