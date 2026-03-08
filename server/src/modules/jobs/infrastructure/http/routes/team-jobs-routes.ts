import { Router } from 'express';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/jobs/infrastructure/http/controllers';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/trajectory-jobs/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const jobsRateLimit = createStandardRateLimiter(5);

router.post('/clear-history', jobsRateLimit, controllers.clearHistory.handle);
router.post('/remove-running', jobsRateLimit, controllers.removeRunningJobs.handle);
router.post('/retry-failed', jobsRateLimit, controllers.retryFailedJobs.handle);

export default module;
