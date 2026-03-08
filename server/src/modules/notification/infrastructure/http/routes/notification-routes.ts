import { notificationValidation } from '@modules/notification/infrastructure/http/validation/notification-schemas';
import controllers from '@modules/notification/infrastructure/http/controllers';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Router } from 'express';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/notifications',
    router
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(protect);
router.use(generalRateLimit);

router.get('/', notificationValidation.listMyNotifications, controllers.getMyNotifications.handle);
router.patch('/read-status', notificationValidation.markAllMyNotificationsAsRead, controllers.markAllAsRead.handle);

export default module;
