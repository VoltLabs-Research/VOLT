import Notification, { NotificationProps } from '@modules/notification/domain/entities/Notification';
import { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<Notification, NotificationProps, NotificationDocument>(Notification, [
    'recipient'
]);
