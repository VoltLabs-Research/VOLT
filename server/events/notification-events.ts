import { createRedisClient } from '@/config/redis';
import logger from '@/logger';
import type { INotification } from '@/types/models/notification';

/**
 * Publish a notification created event to Redis
 * This will be picked up by the notifications socket module
 */
export const publishNotificationCreated = async (userId: string, notification: INotification) => {
    try {
        const redis = createRedisClient();
        const message = JSON.stringify({
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

        await redis.publish('notification:created', message);
        await redis.quit();
    } catch (error) {
        logger.error(`Error publishing notification event: ${error}`);
    }
};
