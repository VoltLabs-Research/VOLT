import Notification from '@modules/notification/models/Notification';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';

const DEFAULT_LIMIT = 100;

interface GetMyNotificationsInput{
    userId: string;
    page?: number;
    limit?: number;
}

const toNotificationView = (notification: Notification) => ({
    _id: notification.id,
    recipient: notification.recipient,
    title: notification.title,
    content: notification.content,
    read: notification.read,
    link: notification.link ?? undefined,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
});

export default class NotificationService{
    async getMyNotifications(input: GetMyNotificationsInput){
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: DEFAULT_LIMIT });
        const [notifications, total] = await Notification.findAndCount({
            where: { recipient: input.userId },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([notifications.map(toNotificationView), total], pageRequest);
    }

    async markAllAsRead(userId: string): Promise<void>{
        await Notification.update({
            recipient: userId,
            read: false
        }, { read: true });
    }

    async create(input: {
        recipient: string;
        title: string;
        content: string;
        link?: string;
    }){
        const notification = await Notification.create({
            ...input,
            link: input.link ?? null,
            read: false
        }).save();

        return toNotificationView(notification);
    }
}
