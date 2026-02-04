import { eventBus, EventChannels } from './event-bus';
import type { INotification } from '@/types/models/notification';

/**
 * Publish a notification created event
 * Uses centralized EventBus instead of creating new Redis client per call
 */
export const publishNotificationCreated = async (
    userId: string,
    notification: INotification
): Promise<void> => {
    await eventBus.emit(EventChannels.NOTIFICATION_CREATED, {
        userId,
        notification: {
            _id: notification._id,
            title: notification.title,
            content: notification.content,
            read: notification.read,
            link: notification.link,
            createdAt: (notification as any).createdAt
        }
    });
};
