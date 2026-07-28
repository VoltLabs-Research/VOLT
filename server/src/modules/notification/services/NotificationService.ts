import Notification from '@modules/notification/models/Notification';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';

const DEFAULT_LIMIT = 100;

interface NotificationView{
    _id: string;
    recipient: string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: Date;
    updatedAt: Date;
}

interface GetMyNotificationsInput{
    userId: string;
    page?: number;
    limit?: number;
}

interface CreateNotificationInput{
    recipient: string;
    title: string;
    content: string;
    link?: string;
}

export default class NotificationService{
    async getMyNotifications(input: GetMyNotificationsInput): Promise<PaginatedResult<NotificationView>>{
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: DEFAULT_LIMIT });
        const [notifications, total] = await Notification.findAndCount({
            where: { recipient: input.userId },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([notifications.map((notification) => this.#toView(notification)), total], pageRequest);
    }

    async markAllAsRead(userId: string): Promise<void>{
        await Notification.update({
            recipient: userId,
            read: false
        }, { read: true });
    }

    async create(input: CreateNotificationInput): Promise<NotificationView>{
        const notification = await Notification.create({
            recipient: input.recipient,
            title: input.title,
            content: input.content,
            link: input.link ?? null,
            read: false
        }).save();

        return this.#toView(notification);
    }

    #toView(notification: Notification): NotificationView{
        return {
            _id: notification.id,
            recipient: notification.recipient,
            title: notification.title,
            content: notification.content,
            read: notification.read,
            link: notification.link ?? undefined,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt
        };
    }
}
