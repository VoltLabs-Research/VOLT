import { Resource } from '@core/constants/resources';
import SecretKeyController from '@modules/team/controllers/secret-key/SecretKeyController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(SecretKeyController);

export default createHttpModule({
    moduleKey: 'team',
    basePath: '/api/teams/:teamId/secret-keys',
    resource: Resource.TEAM_SECRET_KEY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/metrics', controller.teamMetrics);
        router.get('/:secretKeyId/usage', controller.keyUsage);
        router.route('/')
            .get(controller.listByTeamId)
            .post(controller.create);
        router.patch('/:secretKeyId', controller.revokeById);
        router.delete('/:secretKeyId', controller.deleteById);
    }
});
