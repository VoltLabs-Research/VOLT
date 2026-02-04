import express from 'express';
import ContainerController from '@/controllers/docker/container';
import { protect } from '@/middlewares/authentication';
import * as middleware from '@/middlewares/container';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = express.Router();
const controller = new ContainerController();
const rbac = new RBACMiddleware(controller, router);

router.use(protect);

rbac.groupBy(Action.READ)
    .route('/', controller.getAll);

rbac.groupBy(Action.CREATE, middleware.verifyTeamForContainerCreation)
    .route('/', controller.createOne);

rbac.groupBy(Action.UPDATE, middleware.loadAndVerifyContainerAccess)
    .route('/:id', controller.updateOne);

rbac.groupBy(Action.READ, middleware.loadAndVerifyContainerAccess)
    .route('/:id/stats', controller.getContainerStats)
    .route('/:id/files', controller.getContainerFiles)
    .route('/:id/read', controller.readContainerFile)
    .route('/:id/top', controller.getContainerProcesses);

rbac.groupBy(Action.DELETE)
    .route('/:id', controller.deleteOne);

export default router;