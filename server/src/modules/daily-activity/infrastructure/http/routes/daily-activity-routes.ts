import controllers from '@modules/daily-activity/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Router } from 'express';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/daily-activities/:teamId',
    router,
    resource: Resource.DAILY_ACTIVITY
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(generalRateLimit);

router.get('/', controllers.getByTeamId.handle);

export default module;
