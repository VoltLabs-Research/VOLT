import { Resource } from '@core/constants/resources';
import TrajectoryController from '@modules/trajectory/infrastructure/http/controllers/TrajectoryController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TrajectoryController);

export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/particle-filters/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/properties', controller.particleFilterGetProperties);
        router.get('/:trajectoryId/previews', controller.particleFilterPreview);
        router.get('/:trajectoryId/unique-values', controller.particleFilterGetUniqueValues);
        router.get('/:trajectoryId', controller.particleFilterGet);
        router.post('/:trajectoryId', controller.particleFilterApplyAction);
        router.get('/:trajectoryId/properties/:analysisId', controller.particleFilterGetProperties);
        router.get('/:trajectoryId/previews/:analysisId', controller.particleFilterPreview);
        router.get('/:trajectoryId/unique-values/:analysisId', controller.particleFilterGetUniqueValues);
        router.get('/:trajectoryId/:analysisId', controller.particleFilterGet);
        router.post(
            '/:trajectoryId/:analysisId',
            controller.particleFilterApplyAction
        );
    }
});
