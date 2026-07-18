import { Resource } from '@core/constants/resources';
import AnalysisController from '@modules/analysis/infrastructure/http/controllers/AnalysisController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(AnalysisController);

export default createHttpModule({
    moduleKey: 'analysis',
    basePath: '/api/analyses/:teamId',
    resource: Resource.ANALYSIS,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', controller.listByTeamId);
        router.get('/trajectory/:trajectoryId', controller.listByTrajectoryId);
        router.get('/:analysisId/logs/:timestep', controller.getFrameLog);
        router.post('/:analysisId/failed-frames/retries', controller.retryFailedFrames);
        router.route('/:analysisId')
            .get(controller.getById)
            .delete(controller.deleteById);
    }
});
