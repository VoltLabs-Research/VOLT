import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import controllers from '@modules/system/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/system',
    router
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(protect);
router.use(generalRateLimit);

router.get('/stats', controllers.getSystemStats.handle);
router.get('/rbac', controllers.getRbacConfig.handle)

export default module;
