import controllers from '@modules/plugin/infrastructure/http/controllers/exposure';

import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

// TODO: PROTECTED!?
export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/exposures/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controllers.getPluginExposureGLB.handle);
        router.get('/exposures/artifacts/:artifactId/chart', controllers.getPluginExposureChart.handle);
        router.get('/exposures/analyses/:analysisId/export', controllers.getPluginExposureExport.handle);
    }
});
