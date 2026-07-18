import { Resource } from '@core/constants/resources';
import TeamController from '@modules/team/infrastructure/http/controllers/team/TeamController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TeamController);

export default createHttpModule({
    moduleKey: 'team',
    basePath: '/api/teams',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.Param,
    protected: true,
    routes: (router) => {
        router.post('/join/preview', controller.previewJoinByCode);
        router.post('/join', controller.joinByCode);

        router.route('/')
            .get(controller.listUserTeams)
            .post(controller.create);

        router.route('/:teamId')
            .get(controller.getById)
            .patch(controller.updateById)
            .delete(controller.deleteById);

        router.put('/:teamId/default-membership', controller.setDefaultForNewUsers);

        router.get('/:teamId/invite-permission', controller.checkInvitePermission);

        router.route('/:teamId/invite-code')
            .post(controller.generateInviteCode)
            .delete(controller.deleteInviteCode);
    }
});
