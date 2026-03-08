import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamAIIntegrationValidation } from '@modules/team/infrastructure/http/validation/team-ai-integration-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/ai-integration';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/:teamId/ai-integrations',
    router,
    resource: Resource.TEAM
};

const createIntegrationRateLimit = createStandardRateLimiter(5);

router.get('/models', controllers.listModels.handle);
router.post('/discover-models', teamAIIntegrationValidation.discoverModels, controllers.discoverModels.handle);

router.route('/')
    .get(controllers.listByTeamId.handle);

router.route('/:provider')
    .post(createIntegrationRateLimit, teamAIIntegrationValidation.create, controllers.createByProvider.handle)
    .patch(teamAIIntegrationValidation.update, controllers.updateByProvider.handle)
    .delete(controllers.deleteByProvider.handle);

export default module;
