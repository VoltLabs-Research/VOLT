import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Notification, { NotificationProps } from '@modules/notification/domain/entities/Notification';

export interface INotificationRepository extends IBaseRepository<Notification, NotificationProps>{
    /**
     * Mark all notifications as read for the specified user id.
     */
    markAllAsRead(userId: string): Promise<void>;
};