import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/container/infrastructure/http/controllers';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/container/:teamId',
    router,
    resource: Resource.CONTAINER
};

router.use(protect);

router.route('/')
    .post(controllers.create.handle)
    .get(controllers.listByTeamId.handle);

router.route('/:containerId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

router.get('/:containerId/files', controllers.getFilesById.handle);
router.get('/:containerId/processes', controllers.getProcessesById.handle);
router.get('/:containerId/stats', controllers.getStatsById.handle);
router.get('/:containerId/file', controllers.readFileById.handle);

export default module;
