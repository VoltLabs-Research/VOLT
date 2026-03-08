import { Router } from 'express';
import { createExportRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/plugin/infrastructure/http/controllers/exposure';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router,
    resource: Resource.PLUGIN
};

const exportRateLimit = createExportRateLimiter(10);

router.get('/exposure/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controllers.getPluginExposureGLB.handle);
router.get('/exposure/export/analysis/:analysisId', exportRateLimit, controllers.getPluginExposureExport.handle);

export default module;
