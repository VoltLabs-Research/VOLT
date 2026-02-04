import { Router } from 'express';
import RasterController from '@/controllers/raster';
import * as trajectoryMiddleware from '@/middlewares/trajectory';
import * as authMiddleware from '@/middlewares/authentication';

const router = Router();
const controller = new RasterController();

// Routes with teamId prefix for RBAC compatibility
router.get(
    '/:teamId/:id/metadata',
    authMiddleware.optionalAuth,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.getRasterFrameMetadata
);

router.get(
    '/:teamId/:id/frame-data/:timestep/:analysisId/:model',
    authMiddleware.optionalAuth,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.getRasterFrameData
);

router.post(
    '/:teamId/:id/glb/',
    authMiddleware.protect,
    trajectoryMiddleware.checkTeamMembershipForTrajectory,
    controller.rasterizeFrames
);

export default router;
