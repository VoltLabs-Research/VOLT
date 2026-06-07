import { Resource } from '@core/constants/resources';
import controllers from '@modules/cluster/infrastructure/http/controllers';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/teams/:teamId/clusters',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.route('/')
            .get(controllers.listByTeamId.handle)
            .post(controllers.create.handle);
        router.route('/demo')
            .post(controllers.provisionDemo.handle)
            .delete(controllers.deleteDemo.handle);
        router.get('/demo/status', controllers.getDemoStatus.handle);
        router.get('/:teamClusterId', controllers.getById.handle);
        router.get('/:teamClusterId/runtime-snapshot', controllers.getRuntimeSnapshot.handle);
        router.patch(
            '/:teamClusterId/queue-concurrency',
            controllers.updateQueueConcurrency.handle
        );
        router.patch(
            '/:teamClusterId/role',
            controllers.updateRole.handle
        );
        router.route('/:teamClusterId/transfers')
            .get(controllers.listTransferJobs.handle)
            .post(controllers.createTransferRequest.handle);
        router.get(
            '/:teamClusterId/resource-limits',
            controllers.getResourceLimits.handle
        );
        router.post(
            '/:teamClusterId/credentials/reveal',
            RATE_LIMIT_POLICIES.passwordConfirmedClusterAction,
            controllers.revealCredentials.handle
        );
        router.post(
            '/:teamClusterId/remote-access/sessions',
            RATE_LIMIT_POLICIES.passwordConfirmedClusterAction,
            controllers.createRemoteAccessSession.handle
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/entries',
            controllers.listRemoteExplorerEntries.handle
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/node',
            controllers.getRemoteExplorerNode.handle
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/download',
            controllers.downloadRemoteExplorerObject.handle
        );
        router.post(
            '/:teamClusterId/enrollment-token/regenerate',
            controllers.regenerateEnrollmentToken.handle
        );
        router.post(
            '/:teamClusterId/delete-requests',
            RATE_LIMIT_POLICIES.passwordConfirmedClusterAction,
            controllers.deleteById.handle
        );
    }
});
