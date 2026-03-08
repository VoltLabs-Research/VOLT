import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamValidation } from '@modules/team/infrastructure/http/validation/team-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/team';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/teams',
    router,
    resource: Resource.TEAM,
    teamScope: 'param'
};

const createTeamRateLimit = createStandardRateLimiter(5);

const deleteTeamRateLimit = createStandardRateLimiter(5);

const removeMemberRateLimit = createStandardRateLimiter(10);

router.use(protect);

router.route('/')
    .get(controllers.listUserTeams.handle)
    .post(createTeamRateLimit, teamValidation.create, controllers.create.handle);

router.route('/:teamId')
    .get(controllers.getById.handle)
    .patch(teamValidation.update, controllers.updateById.handle)
    .delete(deleteTeamRateLimit, controllers.deleteById.handle);

router.delete('/:teamId/members/:userId', removeMemberRateLimit, teamValidation.removeMember, controllers.removeUserFromTeam.handle);
router.get('/:teamId/invite-permission', controllers.checkInvitePermission.handle);

export default module;
