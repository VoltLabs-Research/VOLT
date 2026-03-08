import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamRoleValidation } from '@modules/team/infrastructure/http/validation/team-role-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/:teamId/roles',
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
