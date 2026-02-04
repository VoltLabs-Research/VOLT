import { Router } from 'express';
import SSHConnectionsController from '@/controllers/docker/ssh-connections';
import * as authMiddleware from '@/middlewares/authentication';
import * as middleware from '@/middlewares/ssh-connection';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new SSHConnectionsController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ)
    .route('/', controller.getAll);

rbac.groupBy(Action.CREATE)
    .route('/', middleware.validateSSHConnectionFields, controller.createOne);

rbac.groupBy(Action.UPDATE, middleware.loadAndVerifySSHConnection)
    .route('/:id', controller.updateOne);

rbac.groupBy(Action.READ, middleware.loadAndVerifySSHConnection)
    .route('/:id/test', controller.testSSHConnection);

rbac.groupBy(Action.DELETE, middleware.loadAndVerifySSHConnection)
    .route('/:id', controller.deleteOne);

export default router;