import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/secret-key';
import { teamSecretKeyValidation } from '@modules/team/infrastructure/http/validation/secret-key';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/secret-keys',
    resource: Resource.TEAM_SECRET_KEY,
    routes: (router) => {
        router.get('/metrics', controllers.teamMetrics.handle);
        router.get('/:secretKeyId/usage', controllers.keyUsage.handle);
        router.route('/')
            .get(controllers.listByTeamId.handle)
            .post(teamSecretKeyValidation.create, controllers.create.handle);
        router.patch('/:secretKeyId', controllers.revokeById.handle);
        router.delete('/:secretKeyId', controllers.deleteById.handle);
    }
});
