import GetNotificationsByUserIdController from './GetNotificationsByUserIdController';
import MarkAllUserNotificationsAsReadController from './MarkAllUserNotificationsAsReadController';
import { container } from 'tsyringe';

export default {
    getByUserId: container.resolve(GetNotificationsByUserIdController),
    readAll: container.resolve(MarkAllUserNotificationsAsReadController)
};