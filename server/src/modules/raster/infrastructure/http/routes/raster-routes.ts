import {
    GetRasterFramePNGController,
    GetRasterMetadataController,
    TriggerRasterizationController
} from '@modules/raster/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { container } from 'tsyringe';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

const triggerController = container.resolve(TriggerRasterizationController);
const metadataController = container.resolve(GetRasterMetadataController);
const frameController = container.resolve(GetRasterFramePNGController);

export default createHttpModule({
    basePath: '/api/rasters/:teamId',
    resource: Resource.RASTER,
    routes: (router) => {
        router.post('/:trajectoryId/jobs', RATE_LIMIT_POLICIES.rasterTrigger, triggerController.handle);
        router.get('/:trajectoryId/metadata', metadataController.handle);
        router.get('/:trajectoryId/frames/:timestep', frameController.handle);
    }
});
