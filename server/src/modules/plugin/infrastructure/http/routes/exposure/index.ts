import controllers from '@modules/plugin/infrastructure/http/controllers/exposure';

import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

// TODO: PROTECTED!?
export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    routes: (router) => {
        router.get('/exposures/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controllers.getPluginExposureGLB.handle);
        router.get('/exposures/analyses/:analysisId/export', RATE_LIMIT_POLICIES.pluginExport, controllers.getPluginExposureExport.handle);
    }
});
