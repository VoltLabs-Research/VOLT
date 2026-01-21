import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/trajectory/infrastructure/http/controllers/particle-filter';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/particle-filter',
    router
};

router.use(protect);

// Routes with optional analysisId (base properties only)
router.get('/properties/:trajectoryId', controllers.getProperties.handle);
router.get('/preview/:trajectoryId', controllers.preview.handle);
router.get('/:trajectoryId', controllers.get.handle);
router.post('/:trajectoryId', controllers.applyAction.handle);

// Routes with analysisId (base + modifier properties)
router.get('/properties/:trajectoryId/:analysisId', controllers.getProperties.handle);
router.get('/preview/:trajectoryId/:analysisId', controllers.preview.handle);
router.get('/:trajectoryId/:analysisId', controllers.get.handle);
router.post('/:trajectoryId/:analysisId', controllers.applyAction.handle);

export default module;
