import express from 'express';
import ContainerController from '@/controllers/container';
import { protect } from '@/middlewares/authentication';
import * as containerMiddleware from '@/middlewares/container';

const router = express.Router();
const containerController = new ContainerController();

router.use(protect);

router.get('/', containerController.getAllContainers);
router.post(
    '/', 
    containerMiddleware.verifyTeamForContainerCreation,
    containerController.createContainer
);
router.post(
    '/:id/control',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerMiddleware.validateContainerAction,
    containerController.controlContainer
);
router.delete(
    '/:id',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.deleteContainer
);
router.get(
    '/:id/stats',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.getContainerStats
);
router.post(
    '/:id/restart',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.restartContainer
);
router.patch(
    '/:id',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.updateContainer
);
router.get(
    '/:id/files',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.getContainerFiles
);
router.get(
    '/:id/read',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.readContainerFile
);
router.get(
    '/:id/top',
    containerMiddleware.loadAndVerifyContainerAccess,
    containerController.getContainerProcesses
);

export default router;
