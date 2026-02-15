import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { canRead, canCreate, canUpdate } from '@shared/infrastructure/http/middleware/authorization';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/container/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/container/:teamId',
    router
};

router.use(protect);

router.route('/')
    .get(canRead(Resource.CONTAINER), controllers.listByTeamId.handle)
    .post(canCreate(Resource.CONTAINER), controllers.create.handle);

router.route('/:containerId')
    .get(canRead(Resource.CONTAINER), controllers.getById.handle)
    .patch(canUpdate(Resource.CONTAINER), controllers.create.handle)
    .delete(canRead(Resource.CONTAINER), controllers.deleteById.handle);


router.get(
    '/:containerId/stats', 
    canRead(Resource.CONTAINER),
    controllers.getStatsById.handle
);

router.get(
    '/:containerId/files', 
    canRead(Resource.CONTAINER), 
    controllers.getFilesById.handle
);

router.get(
    '/:containerId/files/read', 
    canRead(Resource.CONTAINER), 
    controllers.readFileById.handle
);

router.get(
    '/:containerId/processes', 
    canRead(Resource.CONTAINER), 
    controllers.getProcessesById.handle
);

export default module;

