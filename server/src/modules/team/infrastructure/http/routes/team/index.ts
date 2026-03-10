import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team';
import { teamValidation } from '@modules/team/infrastructure/http/validation/team';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/teams',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.route('/')
            .get(controllers.listUserTeams.handle)
            .post(RATE_LIMIT_POLICIES.teamCreate, teamValidation.create, controllers.create.handle);

        router.route('/:teamId')
            .get(controllers.getById.handle)
            .patch(teamValidation.update, controllers.updateById.handle)
            .delete(RATE_LIMIT_POLICIES.teamDelete, controllers.deleteById.handle);

        router.delete(
            '/:teamId/members/:userId',
            RATE_LIMIT_POLICIES.teamMemberRemoval,
            teamValidation.removeMember,
            controllers.removeUserFromTeam.handle
        );

        router.get('/:teamId/invite-permission', controllers.checkInvitePermission.handle);
    }
});
