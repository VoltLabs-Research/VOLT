import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { upload } from '@/src/shared/infrastructure/http/middleware/upload';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';
import controllers from '../controllers/trajectory';

const router = Router();
const module: HttpModule = {
    basePath: '/api/trajectory/:teamId',
    router
};

router.use(protect);

router.route('/')
    .post(upload.array('trajectoryFiles'), controllers.create.handle)
    .get(controllers.getByTeamId.handle);

router.get('/metrics', controllers.getMetrics.handle);
router.get('/:trajectoryId/preview', controllers.getPreview.handle);
router.get('/:trajectoryId/:timestep/:analysisId', controllers.getGLB.handle);

router.route('/:trajectoryId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default module;