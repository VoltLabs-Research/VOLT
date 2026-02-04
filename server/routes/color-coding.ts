import { Router } from 'express';
import ColorCodingController from '@/controllers/trajectory/atoms/color-coding';
import * as midldeware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new ColorCodingController();
const rbac = new RBACMiddleware(controller, router);

router.use(midldeware.protect);

// TODO: checkTeamMembershipForTrajectory
rbac.groupBy(Action.READ, midldeware.protect)
    // Routes with optional analysisId (base properties only)
    .route('/properties/:trajectoryId', controller.getProperties)
    .route('/stats/:trajectoryId', controller.getStats)
    .route('/:trajectoryId', controller.get)
    // Routes with analysisId (base + modifier properties)
    .route('/properties/:trajectoryId/:analysisId', controller.getProperties)
    .route('/stats/:trajectoryId/:analysisId', controller.getStats)
    .route('/:trajectoryId/:analysisId', controller.get);

rbac.groupBy(Action.CREATE, midldeware.protect)
    .route('/:trajectoryId', controller.create)
    .route('/:trajectoryId/:analysisId', controller.create);

export default router;
