import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import controllers from '@modules/notification/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { notificationValidation } from '@modules/notification/infrastructure/http/validation/notification-schemas';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/notification',
    router
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(protect);
router.use(generalRateLimit);

router.get('/', notificationValidation.listMyNotifications, controllers.getMyNotifications.handle);
router.patch('/read-all', notificationValidation.markAllMyNotificationsAsRead, controllers.markAllAsRead.handle);

export default module;
