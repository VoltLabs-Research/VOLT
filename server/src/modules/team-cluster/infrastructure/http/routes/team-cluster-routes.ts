import { Resource } from '@core/constants/resources';
import controllers from '@modules/team-cluster/infrastructure/http/controllers';
import { teamClusterValidation } from '@modules/team-cluster/infrastructure/http/validation/team-cluster-schemas';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/clusters',
    resource: Resource.TEAM,
    routes: (router) => {
        router.route('/')
            .get(teamClusterValidation.listByTeamId, controllers.listByTeamId.handle)
            .post(teamClusterValidation.create, controllers.create.handle);
        router.get('/:teamClusterId', teamClusterValidation.getById, controllers.getById.handle);
        router.get(
            '/:teamClusterId/resource-limits',
            teamClusterValidation.getResourceLimits,
            controllers.getResourceLimits.handle
        );
        router.get(
            '/:teamClusterId/available-updates',
            teamClusterValidation.fetchAvailableVersions,
            controllers.fetchAvailableVersions.handle
        );
        router.post(
            '/:teamClusterId/credentials/reveal',
            teamClusterValidation.revealCredentials,
            controllers.revealCredentials.handle
        );
        router.post(
            '/:teamClusterId/remote-access/sessions',
            teamClusterValidation.createRemoteAccessSession,
            controllers.createRemoteAccessSession.handle
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/entries',
            teamClusterValidation.listRemoteExplorerEntries,
            controllers.listRemoteExplorerEntries.handle
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/node',
            teamClusterValidation.getRemoteExplorerNode,
            controllers.getRemoteExplorerNode.handle
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/download',
            teamClusterValidation.downloadRemoteExplorerObject,
            controllers.downloadRemoteExplorerObject.handle
        );
        router.post(
            '/:teamClusterId/enrollment-token/regenerate',
            teamClusterValidation.regenerateEnrollmentToken,
            controllers.regenerateEnrollmentToken.handle
        );
        router.post(
            '/:teamClusterId/delete-requests',
            teamClusterValidation.deleteById,
            controllers.deleteById.handle
        );
        router.post(
            '/:teamClusterId/update-requests',
            teamClusterValidation.requestUpdate,
            controllers.requestUpdate.handle
        );
        router.post(
            '/:teamClusterId/role',
            teamClusterValidation.updateRole,
            controllers.updateRole.handle
        );
    }
});
