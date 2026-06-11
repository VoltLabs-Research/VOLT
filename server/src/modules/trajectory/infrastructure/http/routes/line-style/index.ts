import { Resource } from '@core/constants/resources';
import controllers from '@modules/trajectory/infrastructure/http/controllers/line-style';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/line-styles/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/:analysisId/:exposureId', controllers.get.handle);
        router.post('/:trajectoryId/:analysisId/:exposureId', controllers.create.handle);
        router.get('/:trajectoryId/:analysisId/:exposureId/ranges', controllers.getRanges.handle);
        router.get('/:trajectoryId/:analysisId/:exposureId/entities/:entityId', controllers.getEntityProperties.handle);
    }
});
