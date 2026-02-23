import { Router } from 'express';
import { container } from 'tsyringe';
import { TriggerRasterizationController } from '@modules/raster/infrastructure/http/controllers/TriggerRasterizationController';
import { GetRasterMetadataController } from '@modules/raster/infrastructure/http/controllers/GetRasterMetadataController';
import { GetRasterFramePNGController } from '@modules/raster/infrastructure/http/controllers/GetRasterFramePNGController';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/raster/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const triggerController = container.resolve(TriggerRasterizationController);
const metadataController = container.resolve(GetRasterMetadataController);
const frameController = container.resolve(GetRasterFramePNGController);

router.use(protect);

router.post('/:trajectoryId/trigger', (req, res, next) => triggerController.handle(req, res, next));
router.get('/:trajectoryId/metadata', (req, res, next) => metadataController.handle(req, res, next));
router.get('/:trajectoryId/frame/:timestep', (req, res, next) => frameController.handle(req, res, next));

export default module;
