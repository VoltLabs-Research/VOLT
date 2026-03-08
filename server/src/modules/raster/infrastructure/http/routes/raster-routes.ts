import { Router } from 'express';
import { container } from 'tsyringe';
import { TriggerRasterizationController } from '@modules/raster/infrastructure/http/controllers/TriggerRasterizationController';
import { GetRasterMetadataController } from '@modules/raster/infrastructure/http/controllers/GetRasterMetadataController';
import { GetRasterFramePNGController } from '@modules/raster/infrastructure/http/controllers/GetRasterFramePNGController';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/rasters/:teamId',
    router,
    resource: Resource.RASTER
};

const triggerController = container.resolve(TriggerRasterizationController);
const metadataController = container.resolve(GetRasterMetadataController);
const frameController = container.resolve(GetRasterFramePNGController);

const triggerRasterRateLimit = createStandardRateLimiter(3);

router.post('/:trajectoryId/jobs', triggerRasterRateLimit, triggerController.handle);
router.get('/:trajectoryId/metadata', metadataController.handle);
router.get('/:trajectoryId/frames/:timestep', frameController.handle);

export default module;
