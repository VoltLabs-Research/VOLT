import { Resource } from '@core/constants/resources';
import TrajectoryController from '@modules/trajectory/infrastructure/http/controllers/TrajectoryController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/line-styles/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/:analysisId/:exposureId', controller.lineStyleGet);
        router.post('/:trajectoryId/:analysisId/:exposureId', controller.lineStyleCreate);
        router.get('/:trajectoryId/:analysisId/:exposureId/ranges', controller.lineStyleGetRanges);
        router.get('/:trajectoryId/:analysisId/:exposureId/entities/:entityId', controller.lineStyleGetEntityProperties);
    }
});
