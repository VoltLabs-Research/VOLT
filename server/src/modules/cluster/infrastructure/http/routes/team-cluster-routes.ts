import { Resource } from '@core/constants/resources';
import ClusterController from '@modules/cluster/infrastructure/http/controllers/ClusterController';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import { container } from 'tsyringe';

const controller = container.resolve(ClusterController);

export default createHttpModule({
    basePath: '/api/teams/:teamId/clusters',
    moduleKey: 'cluster',
    resource: Resource.TEAM,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.route('/')
            .get(controller.listByTeamId)
            .post(controller.create);
        router.route('/demo')
            .post(controller.provisionDemo)
            .delete(controller.deleteDemo);
        router.get('/demo/status', controller.getDemoStatus);
        router.get('/:teamClusterId', controller.getById);
        router.get('/:teamClusterId/runtime-snapshot', controller.getRuntimeSnapshot);
        router.patch(
            '/:teamClusterId/queue-concurrency',
            controller.updateQueueConcurrency
        );
        router.patch(
            '/:teamClusterId/role',
            controller.updateRole
        );
        router.route('/:teamClusterId/transfers')
            .get(controller.listTransferJobs)
            .post(controller.createTransferRequest);
        router.get(
            '/:teamClusterId/resource-limits',
            controller.getResourceLimits
        );
        router.post(
            '/:teamClusterId/credentials/reveal',
            RATE_LIMIT_POLICIES.passwordConfirmedClusterAction,
            controller.revealCredentials
        );
        router.post(
            '/:teamClusterId/remote-access/sessions',
            RATE_LIMIT_POLICIES.passwordConfirmedClusterAction,
            controller.createRemoteAccessSession
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/entries',
            controller.listRemoteExplorerEntries
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/node',
            controller.getRemoteExplorerNode
        );
        router.post(
            '/:teamClusterId/remote-access/explorer/download',
            controller.downloadRemoteExplorerObject
        );
        router.post(
            '/:teamClusterId/enrollment-token/regenerate',
            controller.regenerateEnrollmentToken
        );
        router.post(
            '/:teamClusterId/delete-requests',
            RATE_LIMIT_POLICIES.passwordConfirmedClusterAction,
            controller.deleteById
        );
    }
});
