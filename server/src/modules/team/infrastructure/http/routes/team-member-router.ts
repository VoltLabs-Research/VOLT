import { Router } from 'express';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamMemberValidation } from '@modules/team/infrastructure/http/validation/team-member-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/team-member';

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
