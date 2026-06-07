import { Resource } from '@core/constants/resources';
import controllers from '@modules/trajectory/infrastructure/http/controllers/particle-filter';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/particle-filters/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/properties', controllers.getProperties.handle);
        router.get('/:trajectoryId/previews', controllers.preview.handle);
        router.get('/:trajectoryId/unique-values', controllers.getUniqueValues.handle);
        router.get('/:trajectoryId', controllers.get.handle);
        router.post('/:trajectoryId', controllers.applyAction.handle);
        router.get('/:trajectoryId/properties/:analysisId', controllers.getProperties.handle);
        router.get('/:trajectoryId/previews/:analysisId', controllers.preview.handle);
        router.get('/:trajectoryId/unique-values/:analysisId', controllers.getUniqueValues.handle);
        router.get('/:trajectoryId/:analysisId', controllers.get.handle);
        router.post(
            '/:trajectoryId/:analysisId',
            controllers.applyAction.handle
        );
    }
});
