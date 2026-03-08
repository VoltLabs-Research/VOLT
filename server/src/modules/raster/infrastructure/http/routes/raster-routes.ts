import {
    GetRasterFramePNGController,
    GetRasterMetadataController,
    TriggerRasterizationController
} from '@modules/raster/infrastructure/http/controllers';
import { Resource } from '@core/constants/resources';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Router } from 'express';
import { container } from 'tsyringe';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

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
