import { Resource } from '@core/constants/resources';
import TeamAIIntegrationController from '@modules/team/controllers/ai-integration/TeamAIIntegrationController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(TeamAIIntegrationController);

export default createHttpModule({
    moduleKey: 'team',
    basePath: '/api/teams/:teamId/ai-integrations',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/models', controller.listModels);
        router.route('/').get(controller.listByTeamId);
        router.route('/:provider')
            .post(controller.createByProvider)
            .patch(controller.updateByProvider)
            .delete(controller.deleteByProvider);
    }
});
