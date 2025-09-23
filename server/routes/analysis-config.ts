import { Router } from 'express';
import * as controller from '@/controllers/analysis-config';
import * as middleware from '@/middlewares/analysis-config';
import * as authMiddleware from '@/middlewares/authentication';

const router = Router();

// Allow public access for public trajectories while supporting authenticated users
router.use(authMiddleware.optionalAuth);
router.get(
    '/:id',
    middleware.checkTeamMembershipForAnalysisTrajectory,
    controller.getAnalysisConfigById
);

router.get(
    '/:id/dislocations',
    middleware.checkTeamMembershipForAnalysisTrajectory,
    controller.getAnalysisDislocations

)

router.get(
    '/team/:teamId',
    authMiddleware.protect,
    controller.listAnalysisConfigsByTeam
)

router.delete(
    '/:id',
    middleware.checkTeamMembershipForAnalysisTrajectory,
    controller.deleteAnalysisConfigById
)

export default router;