import { Router } from 'express';
import { createGeneralRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/daily-activity/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/daily-activity/:teamId',
    router,
    resource: Resource.DAILY_ACTIVITY
};

const generalRateLimit = createGeneralRateLimiter(60);

router.use(generalRateLimit);

router.get('/', controllers.getByTeamId.handle);

export default module;
