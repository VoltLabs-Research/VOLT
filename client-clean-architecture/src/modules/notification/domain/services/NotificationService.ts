import type { Notification } from '../entities/Notification';

export class NotificationService {
    countUnread(notifications: Notification[]): number {
        return notifications.filter((notification) => !notification.read).length;
    }

    mergeNotification(list: Notification[], notification: Notification): Notification[] {
        if (list.some((item) => item._id === notification._id)) {
            return list;
        }

        return [notification, ...list];
    }

    markAsRead(list: Notification[], notificationId: string): Notification[] {
        return list.map((item) =>
            item._id === notificationId ? { ...item, read: true } : item
        );
    }

    markAllAsRead(list: Notification[]): Notification[] {
        return list.map((item) => ({ ...item, read: true }));
    }
}
