import notificationMapper from '@modules/notification/infrastructure/persistence/mongo/mappers/NotificationMapper';
import NotificationModel, { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type Notification from '@modules/notification/domain/entities/Notification';
import type { NotificationProps } from '@modules/notification/domain/entities/Notification';

@Singleton()
export default class NotificationRepository
    extends MongooseBaseRepository<Notification, NotificationProps, NotificationDocument>{

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
