import { Router } from 'express';
import TrajectoryJobsController from '@/controllers/trajectory/trajectory-jobs';
import * as authMiddleware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new TrajectoryJobsController();
const rbac = new RBACMiddleware(controller, router);

// All operations require UPDATE permission on TRAJECTORY resource
rbac.groupBy(Action.UPDATE, authMiddleware.protect)
    .route('/:trajectoryId/jobs/clear-history', controller.clearHistory);

rbac.groupBy(Action.UPDATE, authMiddleware.protect)
    .route('/:trajectoryId/jobs/remove-running', controller.removeRunningJobs);

rbac.groupBy(Action.UPDATE, authMiddleware.protect)
    .route('/:trajectoryId/jobs/retry-failed', controller.retryFailedJobs);

export default router;
