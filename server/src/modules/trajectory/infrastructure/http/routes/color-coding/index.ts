import { Resource } from '@core/constants/resources';
import TrajectoryController from '@modules/trajectory/infrastructure/http/controllers/TrajectoryController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/color-codings/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/properties', controller.colorCodingGetProperties);
        router.get('/:trajectoryId/stats', controller.colorCodingGetStats);
        router.get('/:trajectoryId', controller.colorCodingGet);
        router.post('/:trajectoryId', controller.colorCodingCreate);
        router.get('/:trajectoryId/properties/:analysisId', controller.colorCodingGetProperties);
        router.get('/:trajectoryId/stats/:analysisId', controller.colorCodingGetStats);
        router.get('/:trajectoryId/:analysisId', controller.colorCodingGet);
        router.post(
            '/:trajectoryId/:analysisId',
            controller.colorCodingCreate
        );
    }
});
