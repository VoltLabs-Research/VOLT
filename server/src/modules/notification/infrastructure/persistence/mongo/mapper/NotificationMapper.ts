import Notification, { NotificationProps } from '@modules/notification/domain/entities/Notification';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { NotificationDocument } from '@modules/notification/infrastructure/persistence/mongo/models/NotificationModel';

class NotificationMapper extends BaseMapper<Notification, NotificationProps, NotificationDocument>{
    constructor(){
        super(Notification, [
            'recipient'
        ]);
    }
};

export default new NotificationMapper();