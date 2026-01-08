
import { Router } from 'express';
import SimulationCellController from '@/controllers/trajectory/simulation-cells';
import * as authMiddleware from '@middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new SimulationCellController();
const rbac = new RBACMiddleware(controller, router);

rbac.groupBy(Action.READ, authMiddleware.protect)
    .route('/', controller.getAll)
    .route('/:id', controller.getOne);

export default router;
