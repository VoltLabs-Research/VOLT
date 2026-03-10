import GetMyNotificationsController from './GetMyNotificationsController';
import MarkAllMyNotificationsAsReadController from './MarkAllMyNotificationsAsReadController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    getMyNotifications: GetMyNotificationsController,
    markAllAsRead: MarkAllMyNotificationsAsReadController
});