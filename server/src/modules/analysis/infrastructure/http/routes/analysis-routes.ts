import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import controllers from '@modules/analysis/infrastructure/http/controllers';
import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/analyses/:teamId',
    router,
    resource: Resource.ANALYSIS
};

const deleteAnalysisRateLimit = createStandardRateLimiter(30);

router.get('/', controllers.listByTeamId.handle);
router.get('/trajectory/:trajectoryId', controllers.listByTrajectoryId.handle);

router.post('/:analysisId/failed-frames/retries', controllers.retryFailedFrames.handle);

router.route('/:analysisId')
    .get(controllers.getById.handle)
    .delete(deleteAnalysisRateLimit, controllers.deleteById.handle);

export default module;
