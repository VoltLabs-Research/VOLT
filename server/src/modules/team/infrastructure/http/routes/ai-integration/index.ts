import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/ai-integration';
import { teamAIIntegrationValidation } from '@modules/team/infrastructure/http/validation/ai-integration';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/teams/:teamId/ai-integrations',
    resource: Resource.TEAM,
    routes: (router) => {
        router.get('/models', controllers.listModels.handle);
        router.route('/').get(controllers.listByTeamId.handle);
        router.route('/:provider')
            .post(RATE_LIMIT_POLICIES.teamAIIntegrationCreate, teamAIIntegrationValidation.create, controllers.createByProvider.handle)
            .patch(teamAIIntegrationValidation.update, controllers.updateByProvider.handle)
            .delete(controllers.deleteByProvider.handle);
    }
});
