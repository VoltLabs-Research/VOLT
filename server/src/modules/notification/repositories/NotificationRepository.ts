import type { INotificationRepository } from '@modules/notification/ports/INotificationRepository';
import { NOTIFICATION_TOKENS } from '@modules/notification/di/NotificationTokens';
import notificationMapper from '@modules/notification/mappers/NotificationMapper';
import NotificationModel, { NotificationDocument } from '@modules/notification/models/NotificationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type Notification from '@modules/notification/entities/Notification';
import type { NotificationProps } from '@modules/notification/entities/Notification';

@Singleton(NOTIFICATION_TOKENS.NotificationRepository)
export default class NotificationRepository
    extends MongooseBaseRepository<Notification, NotificationProps, NotificationDocument>
    implements INotificationRepository {

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
