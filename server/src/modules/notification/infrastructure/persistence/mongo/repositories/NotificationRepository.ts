import NotificationModel, { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';
import notificationMapper from '@modules/notification/infrastructure/persistence/mongo/mappers/NotificationMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import type { NotificationProps } from '@modules/notification/domain/entities/Notification';
import type Notification from '@modules/notification/domain/entities/Notification';

@injectable()
export default class NotificationRepository
    extends MongooseBaseRepository<Notification, NotificationProps, NotificationDocument>
    implements INotificationRepository{

    constructor(){
        super(NotificationModel, notificationMapper);
    }

    async markAllAsRead(userId: string): Promise<void>{
        await this.model.updateMany(
            { recipient: userId, read: false },
            { read: true }
        );
    }
};
