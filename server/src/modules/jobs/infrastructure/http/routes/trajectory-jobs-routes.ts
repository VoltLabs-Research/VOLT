import { Router } from 'express';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/jobs/infrastructure/http/controllers';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/trajectory-jobs/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

router.use(protect);

router.post('/:trajectoryId/clear-history', controllers.clearHistory.handle);
router.post('/:trajectoryId/remove-running', controllers.removeRunningJobs.handle);
router.post('/:trajectoryId/retry-failed', controllers.retryFailedJobs.handle);

export default module;
