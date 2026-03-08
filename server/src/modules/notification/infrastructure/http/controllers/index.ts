import GetMyNotificationsController from './GetMyNotificationsController';
import MarkAllMyNotificationsAsReadController from './MarkAllMyNotificationsAsReadController';
import { container } from 'tsyringe';

export default {
    getMyNotifications: container.resolve(GetMyNotificationsController),
    markAllAsRead: container.resolve(MarkAllMyNotificationsAsReadController)
};
