import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-member';
import { teamMemberValidation } from '@modules/team/infrastructure/http/validation/team-member';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/members',
    resource: Resource.TEAM_MEMBER,
    routes: (router) => {
        router.get('/', controllers.listByTeamId.handle);

        router.route('/:teamMemberId')
            .get(controllers.getById.handle)
            .patch(teamMemberValidation.update, controllers.updateById.handle);

        router.delete('/:memberId', teamMemberValidation.deleteById, controllers.deleteById.handle);
    }
});
