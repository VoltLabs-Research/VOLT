import { Router } from 'express';
import AnalysisConfigController from '@/controllers/analysis-config';
import * as middleware from '@/middlewares/analysis-config';
import * as authMiddleware from '@/middlewares/authentication';

const router = Router();
const controller = new AnalysisConfigController();

// Allow public access for public trajectories while supporting authenticated users
router.use(authMiddleware.optionalAuth);
router.get(
    '/:id',
    middleware.checkTeamMembershipForAnalysisTrajectory,
    controller.getOne
);

router.get(
    '/team/:teamId',
    authMiddleware.protect,
    controller.listByTeam
)

router.delete(
    '/:id',
    middleware.checkTeamMembershipForAnalysisTrajectory,
    controller.deleteOne
)

export default router;