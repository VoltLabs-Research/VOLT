import Notification from '@modules/notification/domain/entities/Notification';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import type { NotificationProps } from '@modules/notification/domain/entities/Notification';
import type { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';

export default createMongoMapper<Notification, NotificationProps, NotificationDocument>(Notification, [
    'recipient'
]);
