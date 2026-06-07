import { Resource } from '@core/constants/resources';
import controllers from '@modules/trajectory/infrastructure/http/controllers/color-coding';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/color-codings/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/properties', controllers.getProperties.handle);
        router.get('/:trajectoryId/stats', controllers.getStats.handle);
        router.get('/:trajectoryId', controllers.get.handle);
        router.post('/:trajectoryId', controllers.create.handle);
        router.get('/:trajectoryId/properties/:analysisId', controllers.getProperties.handle);
        router.get('/:trajectoryId/stats/:analysisId', controllers.getStats.handle);
        router.get('/:trajectoryId/:analysisId', controllers.get.handle);
        router.post(
            '/:trajectoryId/:analysisId',
            controllers.create.handle
        );
    }
});
