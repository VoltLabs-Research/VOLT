import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';
import { teamRoleValidation } from '@modules/team/infrastructure/http/validation/team-role';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/:teamId/roles',
    router,
    resource: Resource.TEAM_ROLE
};

const createRoleRateLimit = createStandardRateLimiter(10);

router.route('/')
    .get(controllers.listByTeamId.handle)
    .post(createRoleRateLimit, teamRoleValidation.create, controllers.create.handle);

router.route('/:roleId')
    .delete(controllers.deleteById.handle)
    .get(controllers.getById.handle)
    .patch(teamRoleValidation.update, controllers.updateById.handle);

export default module;
