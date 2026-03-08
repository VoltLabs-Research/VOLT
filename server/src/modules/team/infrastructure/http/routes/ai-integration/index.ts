import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/ai-integration';
import { teamAIIntegrationValidation } from '@modules/team/infrastructure/http/validation/ai-integration';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/:teamId/ai-integrations',
    router,
    resource: Resource.TEAM
};

const createIntegrationRateLimit = createStandardRateLimiter(5);

router.get('/models', controllers.listModels.handle);

router.post('/model-discovery', teamAIIntegrationValidation.discoverModels, controllers.discoverModels.handle);

router.route('/')
    .get(controllers.listByTeamId.handle);

router.route('/:provider')
    .post(createIntegrationRateLimit, teamAIIntegrationValidation.create, controllers.createByProvider.handle)
    .patch(teamAIIntegrationValidation.update, controllers.updateByProvider.handle)
    .delete(controllers.deleteByProvider.handle);

export default module;
