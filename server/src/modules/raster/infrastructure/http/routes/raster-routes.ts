import {
    GetRasterFramePNGController,
    GetRasterMetadataController,
    TriggerRasterizationController
} from '@modules/raster/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { container } from 'tsyringe';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

const triggerController = container.resolve(TriggerRasterizationController);
const metadataController = container.resolve(GetRasterMetadataController);
const frameController = container.resolve(GetRasterFramePNGController);

export default createHttpModule({
    basePath: '/api/rasters/:teamId',
    resource: Resource.RASTER,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.post('/:trajectoryId/jobs', triggerController.handle);
        router.get('/:trajectoryId/metadata', metadataController.handle);
        router.get('/:trajectoryId/frames/:timestep', frameController.handle);
        router.get('/:trajectoryId/frames/:timestep/:analysisId/:model', frameController.handle);
    }
});
