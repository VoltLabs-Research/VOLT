import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { canRead, canCreate, canUpdate } from '@/src/shared/infrastructure/http/middleware/authorization';
import { Resource } from '@/src/core/constants/resources';
import controllers from '../controllers';

const router = Router();

router.use(protect);

router.route('/:teamId')
    .get(canRead(Resource.CONTAINER), controllers.listByTeamId.handle)
    .post(canCreate(Resource.CONTAINER), controllers.create.handle);

router.route('/:teamId/:containerId')
    .get(canRead(Resource.CONTAINER), controllers.getById.handle)
    .patch(canUpdate(Resource.CONTAINER), controllers.create.handle)
    .delete(canRead(Resource.CONTAINER), controllers.deleteById.handle);


router.get(
    '/:teamId/:containerId/stats', 
    canRead(Resource.CONTAINER),
    controllers.getStatsById.handle
);

router.get(
    '/:teamId/:containerId/files', 
    canRead(Resource.CONTAINER), 
    controllers.getFilesById.handle
);

router.get(
    '/:teamId/:containerId/files/read', 
    canRead(Resource.CONTAINER), 
    controllers.readFileById.handle
);

router.get(
    '/:teamId/:containerId/processes', 
    canRead(Resource.CONTAINER), 
    controllers.getProcessesById.handle
);

export default router;

