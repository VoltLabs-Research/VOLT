import { Resource } from '@core/constants/resources';
import controllers from '@modules/analysis/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/analyses/:teamId',
    resource: Resource.ANALYSIS,
    routes: (router) => {
        router.get('/', controllers.listByTeamId.handle);
        router.get('/trajectory/:trajectoryId', controllers.listByTrajectoryId.handle);
        router.post('/:analysisId/failed-frames/retries', controllers.retryFailedFrames.handle);
        router.route('/:analysisId')
            .get(controllers.getById.handle)
            .delete(RATE_LIMIT_POLICIES.analysisDelete, controllers.deleteById.handle);
    }
});
