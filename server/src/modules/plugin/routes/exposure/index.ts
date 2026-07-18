import PluginController from '@modules/plugin/controllers/PluginController';

import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(PluginController);

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    moduleKey: 'plugin',
    routes: (router) => {
        router.get('/exposures/glb/:trajectoryId/:analysisId/:exposureId/:timestep', controller.getPluginExposureGLB);
        router.get('/exposures/artifacts/:artifactId/chart', controller.getPluginExposureChart);
        router.get('/exposures/analyses/:analysisId/export', controller.getPluginExposureExport);
    }
});
