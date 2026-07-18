import NotificationModel from '@modules/notification/models/NotificationModel';
import type { NotificationDocument } from '@modules/notification/models/NotificationModel';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

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

/**
 * The single application service for the notification module (pollium style:
 * holds ALL the notification domain logic, talks to the Mongoose
 * {@link NotificationModel} directly — no repository, entity, mapper, use case
 * or DI). `getMyNotifications` + `markAllAsRead` back the HTTP controller and the
 * `get_notifications` AI tool; `create` backs the module's event handlers
 * (welcome / onboarding / invitation notifications). Notification has no
 * cross-module DI consumers, so there is no neutral-token adapter — only the
 * cascade-delete adapter in `repositories/NotificationRepository.ts`.
 */
export default class NotificationService{
    async getMyNotifications(input: GetMyNotificationsInput): Promise<PaginatedResult<NotificationView>>{
        const page = input.page ?? 1;
        const limit = input.limit ?? 100;
        const filter = { recipient: input.userId };

        const [docs, total] = await Promise.all([
            NotificationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
            NotificationModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#toView(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async markAllAsRead(userId: string): Promise<void>{
        await NotificationModel.updateMany({ recipient: userId, read: false }, { read: true });
    }

    async create(input: CreateNotificationInput): Promise<NotificationView>{
        const notification = await NotificationModel.create({
            recipient: input.recipient,
            title: input.title,
            content: input.content,
            link: input.link,
            read: false
        });
        return this.#toView(notification);
    }

    #toView(doc: NotificationDocument): NotificationView{
        return {
            _id: String(doc._id),
            recipient: String(doc.recipient),
            title: doc.title,
            content: doc.content,
            read: doc.read,
            link: doc.link,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}
