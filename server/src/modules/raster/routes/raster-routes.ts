import RasterController from '@modules/raster/controllers/RasterController';
import { Resource } from '@core/constants/resources';
import { container } from 'tsyringe';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

const controller = container.resolve(RasterController);

export default createHttpModule({
    basePath: '/api/rasters/:teamId',
    resource: Resource.RASTER,
    moduleKey: 'raster',
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.post('/:trajectoryId/jobs', controller.triggerRasterization);
        router.get('/:trajectoryId/metadata', controller.getRasterMetadata);
        router.get('/:trajectoryId/frames/:timestep', controller.getRasterFramePNG);
        router.get('/:trajectoryId/frames/:timestep/:analysisId/:model', controller.getRasterFramePNG);
    }
});
