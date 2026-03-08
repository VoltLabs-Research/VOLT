import { Router } from 'express';
import controllers from '@modules/container/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/containers/:teamId',
    router,
    resource: Resource.CONTAINER
};

const createContainerRateLimit = createStandardRateLimiter(5);

const deleteContainerRateLimit = createStandardRateLimiter(10);

router.route('/')
    .post(createContainerRateLimit, controllers.create.handle)
    .get(controllers.listByTeamId.handle);

router.route('/:containerId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(deleteContainerRateLimit, controllers.deleteById.handle);

router.get('/:containerId/files', controllers.getFilesById.handle);
router.get('/:containerId/processes', controllers.getProcessesById.handle);
router.get('/:containerId/stats', controllers.getStatsById.handle);
router.get('/:containerId/files/content', controllers.readFileById.handle);

export default module;
