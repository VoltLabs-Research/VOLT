import Notification, { NotificationProps } from "@/src/modules/notification/domain/entities/Notification";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";
import { NotificationDocument } from "../models/NotificationModel";

class NotificationMapper extends BaseMapper<Notification, NotificationProps, NotificationDocument>{
    constructor(){
        super(Notification, [
            'recipient'
        ]);
    }
};

export default new NotificationMapper();