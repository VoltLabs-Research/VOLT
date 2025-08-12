import { Router } from 'express';
import * as controller from '@/controllers/analysis-config';
import * as middleware from '@/middlewares/analysis-config';
import * as authMiddleware from '@/middlewares/authentication';

const router = Router();

router.use(authMiddleware.protect);
router.get(
    '/:id',
    middleware.checkTeamMembershipForAnalysisTrajectory,
    controller.getAnalysisConfigById
);

export default router;