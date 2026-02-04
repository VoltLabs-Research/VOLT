import { Router } from 'express';
import TrajectoryController from '@/controllers/trajectory/trajectories';
import * as middleware from '@middlewares/trajectory';
import * as authMiddleware from '@middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new TrajectoryController();
const rbac = new RBACMiddleware(controller, router);

rbac.groupBy(Action.READ, authMiddleware.protect)
    .route('/', controller.getAll)
    .route('/metrics', controller.getTeamMetrics)
    .route('/:id/analysis/:analysisId', middleware.checkTeamMembershipForTrajectory, controller.getAtoms);

rbac.groupBy(Action.CREATE, authMiddleware.protect)
    .route('/', middleware.upload.array('trajectoryFiles'), middleware.processAndValidateUpload, controller.createOne);

rbac.groupBy(Action.UPDATE, authMiddleware.protect)
    .route('/:id', middleware.requireTeamMembershipForTrajectory, controller.updateOne);

rbac.groupBy(Action.DELETE, authMiddleware.protect)
    .route('/:id', middleware.requireTeamMembershipForTrajectory, controller.deleteOne);

rbac.groupBy(Action.READ, authMiddleware.optionalAuth, middleware.checkTeamMembershipForTrajectory)
    .route('/:id/download', controller.downloadDumps)
    .route('/:id/:timestep/:analysisId', controller.getGLB)
    .route('/:id/preview', controller.getPreview)
    .route('/:id', controller.getOne);

export default router;