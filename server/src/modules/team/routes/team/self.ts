import TeamController from '@modules/team/controllers/team/TeamController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TeamController);

export default createHttpModule({
    moduleKey: 'team',
    basePath: '/api/teams/:teamId/self',
    teamScope: HttpModuleTeamScope.BasePath,
    protected: true,
    routes: (router) => {
        router.get('/permissions', controller.getMyPermissions);
        router.delete('/membership', controller.leave);
    }
});
