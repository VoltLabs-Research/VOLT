import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/trajectory/infrastructure/http/controllers/color-coding';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/color-coding/:teamId',
    router
};

router.use(protect);

// Routes with optional analysisId (base properties only)
router.get('/properties/:trajectoryId', controllers.getProperties.handle);
router.get('/stats/:trajectoryId', controllers.getStats.handle);
router.get('/:trajectoryId', controllers.get.handle);
router.post('/:trajectoryId', controllers.create.handle);

// Routes with analysisId (base + modifier properties)
router.get('/properties/:trajectoryId/:analysisId', controllers.getProperties.handle);
router.get('/stats/:trajectoryId/:analysisId', controllers.getStats.handle);
router.get('/:trajectoryId/:analysisId', controllers.get.handle);
router.post('/:trajectoryId/:analysisId', controllers.create.handle);

export default module;
