import controllers from '@modules/team/infrastructure/http/controllers/team';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/self',
    teamScope: HttpModuleTeamScope.BasePath,
    protected: true,
    routes: (router) => {
        router.get('/permissions', controllers.getMyPermissions.handle);
        router.delete('/membership', controllers.leave.handle);
    }
});
