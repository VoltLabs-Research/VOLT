import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers/exposure';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/plugin',
    router
};

router.use(protect);

router.get('/:pluginId/exposure/glb', controllers.getPluginExposureGLB.handle);
router.get('/:pluginId/exposure/chart', controllers.getPluginExposureChart.handle);

export default module;
