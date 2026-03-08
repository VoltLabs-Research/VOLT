import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/secret-key';
import { teamSecretKeyValidation } from '@modules/team/infrastructure/http/validation/secret-key';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/:teamId/secret-keys',
    router,
    resource: Resource.TEAM_SECRET_KEY
};

const createSecretKeyRateLimit = createStandardRateLimiter(5);

router.get('/metrics', controllers.teamMetrics.handle);

router.get('/:secretKeyId/usage', controllers.keyUsage.handle);

router.route('/')
    .get(controllers.listByTeamId.handle)
    .post(createSecretKeyRateLimit, teamSecretKeyValidation.create, controllers.create.handle);

router.patch('/:secretKeyId', controllers.revokeById.handle);

router.delete('/:secretKeyId', controllers.deleteById.handle);

export default module;
