import controllers from '@modules/notification/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/notifications',
    protected: true,
    routes: (router) => {
        router.get('/', controllers.getMyNotifications.handle);
        router.patch('/read-status', controllers.markAllAsRead.handle);
    }
});
