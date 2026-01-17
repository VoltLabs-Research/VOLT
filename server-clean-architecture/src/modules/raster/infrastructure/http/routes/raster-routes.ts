import { Router } from 'express';
import { container } from 'tsyringe';
import { TriggerRasterizationController } from '../controllers/TriggerRasterizationController';
import { GetRasterMetadataController } from '../controllers/GetRasterMetadataController';
import { GetRasterFramePNGController } from '../controllers/GetRasterFramePNGController';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';

const router = Router();

const triggerController = container.resolve(TriggerRasterizationController);
const metadataController = container.resolve(GetRasterMetadataController);
const frameController = container.resolve(GetRasterFramePNGController);

router.post('/:trajectoryId/trigger', protect, (req, res, next) => triggerController.handle(req, res, next));
router.get('/:trajectoryId/metadata', protect, (req, res, next) => metadataController.handle(req, res, next));
router.get('/:trajectoryId/frame/:timestep', protect, (req, res, next) => frameController.handle(req, res, next));

export default router;
