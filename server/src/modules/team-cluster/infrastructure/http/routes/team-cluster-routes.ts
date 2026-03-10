import { Resource } from '@core/constants/resources';
import controllers from '@modules/team-cluster/infrastructure/http/controllers';
import { teamClusterValidation } from '@modules/team-cluster/infrastructure/http/validation/team-cluster-schemas';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/teams/:teamId/clusters',
    resource: Resource.TEAM,
    routes: (router) => {
        router.route('/')
            .get(teamClusterValidation.listByTeamId, controllers.listByTeamId.handle)
            .post(RATE_LIMIT_POLICIES.teamClusterCreate, teamClusterValidation.create, controllers.create.handle);
        router.get('/:teamClusterId', teamClusterValidation.getById, controllers.getById.handle);
        router.post(
            '/:teamClusterId/credentials/reveal',
            RATE_LIMIT_POLICIES.teamClusterRevealCredentials,
            teamClusterValidation.revealCredentials,
            controllers.revealCredentials.handle
        );
        router.post(
            '/:teamClusterId/delete-requests',
            RATE_LIMIT_POLICIES.teamClusterDelete,
            teamClusterValidation.deleteById,
            controllers.deleteById.handle
        );
    }
});
