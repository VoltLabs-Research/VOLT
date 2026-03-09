import { Resource } from '@core/constants/resources';
import controllers from '@modules/team-cluster/infrastructure/http/controllers';
import { teamClusterValidation } from '@modules/team-cluster/infrastructure/http/validation/team-cluster-schemas';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/:teamId/clusters',
    router,
    resource: Resource.TEAM
};

const createTeamClusterRateLimiter = createStandardRateLimiter(5);

const revealCredentialsRateLimiter = createStandardRateLimiter(5, 'Too many credential reveal attempts, please try again later');

const deleteTeamClusterRateLimiter = createStandardRateLimiter(5, 'Too many delete attempts, please try again later');

router.route('/')
    .get(teamClusterValidation.listByTeamId, controllers.listByTeamId.handle)
    .post(createTeamClusterRateLimiter, teamClusterValidation.create, controllers.create.handle);

router.get('/:teamClusterId', teamClusterValidation.getById, controllers.getById.handle);
router.post(
    '/:teamClusterId/credentials/reveal',
    revealCredentialsRateLimiter,
    teamClusterValidation.revealCredentials,
    controllers.revealCredentials.handle
);
router.post(
    '/:teamClusterId/delete-requests',
    deleteTeamClusterRateLimiter,
    teamClusterValidation.deleteById,
    controllers.deleteById.handle
);

export default module;
