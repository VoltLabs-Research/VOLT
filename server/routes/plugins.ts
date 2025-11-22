import { Router } from 'express';
import * as controllers from '@/controllers/plugins';
import * as authMiddleware from '@/middlewares/authentication';
import * as trajMiddleware from '@/middlewares/trajectory';

const router = Router();

router.use(authMiddleware.protect);

router.get('/manifests', controllers.getManifests);

router.get(
    '/glb/:id/:analysisId/:exposureId/:timestep',
    trajMiddleware.checkTeamMembershipForTrajectory,
    controllers.getPluginExposureGLB);

router.post(
    '/:pluginId/modifier/:modifierId/trajectory/:id', 
    trajMiddleware.checkTeamMembershipForTrajectory,
    controllers.evaluateModifier);

export default router;