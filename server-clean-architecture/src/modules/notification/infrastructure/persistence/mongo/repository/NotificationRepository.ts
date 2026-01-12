import { INotificationRepository } from "@/src/modules/notification/domain/port/INotificationRepository";
import Notification, { NotificationProps } from "@/src/modules/notification/domain/entities/Notification";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import NotificationModel, { NotificationDocument } from "../models/NotificationModel";
import notificationMapper from '../mapper/NotificationMapper';
import { injectable } from "tsyringe";

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