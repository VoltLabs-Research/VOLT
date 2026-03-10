import controllers from '@modules/container/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/containers/:teamId',
    resource: Resource.CONTAINER,
    routes: (router) => {
        router.route('/')
            .post(RATE_LIMIT_POLICIES.containerCreate, controllers.create.handle)
            .get(controllers.listByTeamId.handle);

        router.route('/:containerId')
            .get(controllers.getById.handle)
            .patch(controllers.updateById.handle)
            .delete(RATE_LIMIT_POLICIES.containerDelete, controllers.deleteById.handle);

        router.get('/:containerId/files', controllers.getFilesById.handle);
        router.get('/:containerId/processes', controllers.getProcessesById.handle);
        router.get('/:containerId/stats', controllers.getStatsById.handle);
        router.get('/:containerId/files/content', controllers.readFileById.handle);
    }
});
