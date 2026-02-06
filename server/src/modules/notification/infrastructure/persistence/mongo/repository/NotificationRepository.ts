import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import Notification, { NotificationProps } from '@modules/notification/domain/entities/Notification';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import NotificationModel, { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';
import notificationMapper from '@modules/notification/infrastructure/persistence/mongo/mapper/NotificationMapper';
import { injectable } from 'tsyringe';

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
}