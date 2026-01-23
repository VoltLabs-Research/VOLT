import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/plugin/infrastructure/http/controllers/exposure';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router
};

router.use(protect);

router.get('/exposure/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controllers.getPluginExposureGLB.handle);
router.get('/:pluginId/exposure/chart', controllers.getPluginExposureChart.handle);

export default module;
