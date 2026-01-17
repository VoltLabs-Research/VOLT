import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetPluginExposureGLBController from '../controllers/exposure/GetPluginExposureGLBController';
import GetPluginExposureChartController from '../controllers/exposure/GetPluginExposureChartController';

const getPluginExposureGLBController = container.resolve(GetPluginExposureGLBController);
const getPluginExposureChartController = container.resolve(GetPluginExposureChartController);

const router = Router();

router.use(protect);

router.get('/:pluginId/exposure/glb', getPluginExposureGLBController.handle);
router.get('/:pluginId/exposure/chart', getPluginExposureChartController.handle);

export default router;
