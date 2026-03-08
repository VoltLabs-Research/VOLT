import { Router } from 'express';
import { createExportRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/plugin/infrastructure/http/controllers/exposure';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugins/:teamId',
    router,
    resource: Resource.PLUGIN
};

const exportRateLimit = createExportRateLimiter(10);

router.get('/exposures/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controllers.getPluginExposureGLB.handle);
router.get('/exposures/analyses/:analysisId/export', exportRateLimit, controllers.getPluginExposureExport.handle);

export default module;
