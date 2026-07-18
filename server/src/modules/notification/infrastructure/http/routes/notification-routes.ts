import NotificationController from '@modules/notification/infrastructure/http/controllers/NotificationController';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(NotificationController);

export default createHttpModule({
    basePath: '/api/notifications',
    moduleKey: 'notification',
    protected: true,
    routes: (router) => {
        router.get('/', controller.getMyNotifications);
        router.patch('/read-status', controller.markAllAsRead);
    }
});
