import DashboardController from '@modules/dashboard/controllers/DashboardController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(DashboardController);

export default createHttpModule({
    basePath: '/api/dashboard/:teamId',
    moduleKey: 'dashboard',
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/search', controller.getGlobalSearch);
    }
});
