import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/jobs/infrastructure/http/controllers';
import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/jobs/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const jobsRateLimit = createStandardRateLimiter(5);

router.delete('/history', jobsRateLimit, controllers.clearHistory.handle);
router.delete('/running', jobsRateLimit, controllers.removeRunningJobs.handle);
router.post('/failed/retries', jobsRateLimit, controllers.retryFailedJobs.handle);

export default module;
