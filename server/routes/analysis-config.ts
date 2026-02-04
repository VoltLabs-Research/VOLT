import { Router } from 'express';
import AnalysisConfigController from '@/controllers/analysis-config';
import * as middleware from '@/middlewares/analysis-config';
import * as authMiddleware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new AnalysisConfigController();
const rbac = new RBACMiddleware(controller, router);

rbac.groupBy(Action.READ, authMiddleware.protect)
    .route('/', controller.getAll);

rbac.groupBy(Action.READ, authMiddleware.optionalAuth, middleware.checkTeamMembership)
    .route('/:id', controller.getOne);

rbac.groupBy(Action.DELETE, authMiddleware.protect)
    .route('/:id', controller.deleteOne);

rbac.groupBy(Action.UPDATE, authMiddleware.protect)
    .route('/:id/retry-failed-frames', controller.retryFailedFrames);

export default router;