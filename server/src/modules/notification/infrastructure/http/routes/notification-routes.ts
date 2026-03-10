import { notificationValidation } from '@modules/notification/infrastructure/http/validation/notification-schemas';
import controllers from '@modules/notification/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/notifications',
    protected: true,
    middleware: RATE_LIMIT_POLICIES.notificationAccess,
    routes: (router) => {
        router.get('/', notificationValidation.listMyNotifications, controllers.getMyNotifications.handle);
        router.patch('/read-status', controllers.markAllAsRead.handle);
    }
});
