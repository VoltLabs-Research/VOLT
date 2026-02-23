import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/plugin/infrastructure/http/controllers/exposure';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router,
    resource: Resource.PLUGIN
};

router.use(protect);

router.get('/exposure/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controllers.getPluginExposureGLB.handle);

export default module;
