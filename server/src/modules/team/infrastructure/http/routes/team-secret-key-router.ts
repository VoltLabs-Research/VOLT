import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamSecretKeyValidation } from '@modules/team/infrastructure/http/validation/team-secret-key-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/secret-key';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/:teamId/secret-keys',
    router,
    resource: Resource.TEAM_SECRET_KEY
};

const createSecretKeyRateLimit = createStandardRateLimiter(5);

router.get('/metrics', controllers.teamMetrics.handle);
router.get('/:secretKeyId/usage', controllers.keyUsage.handle);

router.route('/')
    .get(controllers.listByTeamId.handle)
    .post(createSecretKeyRateLimit, teamSecretKeyValidation.create, controllers.create.handle);

router.patch('/:secretKeyId/revoke', controllers.revokeById.handle);
router.delete('/:secretKeyId', controllers.deleteById.handle);

export default module;
