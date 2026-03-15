import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team';
import { teamValidation } from '@modules/team/infrastructure/http/validation/team';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.post('/join', teamValidation.joinByCode, controllers.joinByCode.handle);

        router.route('/')
            .get(controllers.listUserTeams.handle)
            .post(teamValidation.create, controllers.create.handle);

        router.route('/:teamId')
            .get(controllers.getById.handle)
            .patch(teamValidation.update, controllers.updateById.handle)
            .delete(controllers.deleteById.handle);

        router.get('/:teamId/invite-permission', controllers.checkInvitePermission.handle);

        router.route('/:teamId/invite-code')
            .post(controllers.generateInviteCode.handle)
            .delete(controllers.deleteInviteCode.handle);
    }
});
