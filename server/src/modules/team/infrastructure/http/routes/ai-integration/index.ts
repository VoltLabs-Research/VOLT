import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/ai-integration';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/ai-integrations',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/models', controllers.listModels.handle);
        router.route('/').get(controllers.listByTeamId.handle);
        router.route('/:provider')
            .post(controllers.createByProvider.handle)
            .patch(controllers.updateByProvider.handle)
            .delete(controllers.deleteByProvider.handle);
    }
});
