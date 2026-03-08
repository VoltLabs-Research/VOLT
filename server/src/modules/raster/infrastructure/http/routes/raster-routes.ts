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
    basePath: '/api/raster/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const triggerController = container.resolve(TriggerRasterizationController);
const metadataController = container.resolve(GetRasterMetadataController);
const frameController = container.resolve(GetRasterFramePNGController);

const triggerRasterRateLimit = createStandardRateLimiter(3);

router.post('/:trajectoryId/trigger', triggerRasterRateLimit, (req, res) => triggerController.handle(req, res));
router.get('/:trajectoryId/metadata', (req, res) => metadataController.handle(req, res));
router.get('/:trajectoryId/frame/:timestep', (req, res) => frameController.handle(req, res));

export default module;
