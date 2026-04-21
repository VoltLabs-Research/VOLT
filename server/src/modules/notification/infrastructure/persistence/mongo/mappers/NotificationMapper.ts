import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createNotification } from '@modules/notification/domain/entities/Notification';
import type Notification from '@modules/notification/domain/entities/Notification';
import type { NotificationProps } from '@modules/notification/domain/entities/Notification';
import type { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';

export default createMongoMapperFromFactory<Notification, NotificationProps, NotificationDocument>(createNotification, [
    'recipient'
]);
