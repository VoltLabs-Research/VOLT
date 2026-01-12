import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import Notification, { NotificationProps } from '../entities/Notification';

export interface INotificationRepository extends IBaseRepository<Notification, NotificationProps>{
    /**
     * Mark all notifications as read for the specified user id.
     */
    markAllAsRead(userId: string): Promise<void>;
};