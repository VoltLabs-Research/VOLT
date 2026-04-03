import controllers from '@modules/dashboard/infrastructure/http/controllers';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/dashboard/:teamId',
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/search', controllers.getGlobalSearch.handle);
    }
});
