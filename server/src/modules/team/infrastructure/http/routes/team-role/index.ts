import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';
import { teamRoleValidation } from '@modules/team/infrastructure/http/validation/team-role';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/teams/:teamId/roles',
    resource: Resource.TEAM_ROLE,
    routes: (router) => {
        router.route('/')
            .get(controllers.listByTeamId.handle)
            .post(RATE_LIMIT_POLICIES.teamRoleCreate, teamRoleValidation.create, controllers.create.handle);

        router.route('/:roleId')
            .delete(controllers.deleteById.handle)
            .get(controllers.getById.handle)
            .patch(teamRoleValidation.update, controllers.updateById.handle);
    }
});
