import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/secret-key';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/secret-keys',
    resource: Resource.TEAM_SECRET_KEY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/metrics', controllers.teamMetrics.handle);
        router.get('/:secretKeyId/usage', controllers.keyUsage.handle);
        router.route('/')
            .get(controllers.listByTeamId.handle)
            .post(controllers.create.handle);
        router.patch('/:secretKeyId', controllers.revokeById.handle);
        router.delete('/:secretKeyId', controllers.deleteById.handle);
    }
});
