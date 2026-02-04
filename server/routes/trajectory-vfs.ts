import { Router } from 'express';
import TrajectoryVfsController from '@/controllers/trajectory/trajectory-vfs';
import * as authMiddleware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new TrajectoryVfsController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ)
    .route('/', controller.listTrajectoryFs)
    .route('/download', controller.downloadTrajectoryFs)
    .route('/trajectories', controller.listUserTrajectories);

export default router;
