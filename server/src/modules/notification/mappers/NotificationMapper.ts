import { createMongoMapperFromFactory } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import { createNotification } from '@modules/notification/entities/Notification';
import type Notification from '@modules/notification/entities/Notification';
import type { NotificationProps } from '@modules/notification/entities/Notification';
import type { NotificationDocument } from '@modules/notification/models/NotificationModel';

export default createMongoMapperFromFactory<Notification, NotificationProps, NotificationDocument>(createNotification, [
    'recipient'
]);
