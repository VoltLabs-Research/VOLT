import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers/exposure';

const router = Router();

router.use(protect);

router.get('/:pluginId/exposure/glb', controllers.getPluginExposureGLB.handle);
router.get('/:pluginId/exposure/chart', controllers.getPluginExposureChart.handle);

export default router;
