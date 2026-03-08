import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-member';
import { teamMemberValidation } from '@modules/team/infrastructure/http/validation/team-member';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/:teamId/members',
    router,
    resource: Resource.TEAM_MEMBER
};

router.get('/', controllers.listByTeamId.handle);

router.route('/:teamMemberId')
    .get(controllers.getById.handle)
    .patch(teamMemberValidation.update, controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default module;
