import { Resource } from '@core/constants/resources';
import controllers from '@modules/analysis/infrastructure/http/controllers';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/analyses/:teamId',
    resource: Resource.ANALYSIS,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', controllers.listByTeamId.handle);
        router.get('/trajectory/:trajectoryId', controllers.listByTrajectoryId.handle);
        router.get('/:analysisId/logs/:timestep', controllers.getFrameLog.handle);
        router.post('/:analysisId/failed-frames/retries', controllers.retryFailedFrames.handle);
        router.route('/:analysisId')
            .get(controllers.getById.handle)
            .delete(controllers.deleteById.handle);
    }
});
