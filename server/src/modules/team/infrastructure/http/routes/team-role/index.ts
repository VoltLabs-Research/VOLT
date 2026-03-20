import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';
import { teamRoleValidation } from '@modules/team/infrastructure/http/validation/team-role';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/roles',
    resource: Resource.TEAM_ROLE,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.route('/')
            .get(controllers.listByTeamId.handle)
            .post(teamRoleValidation.create, controllers.create.handle);

        router.route('/:roleId')
            .delete(controllers.deleteById.handle)
            .get(controllers.getById.handle)
            .patch(teamRoleValidation.update, controllers.updateById.handle);
    }
});
