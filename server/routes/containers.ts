import express from 'express';
import ContainerController from '@/controllers/container';
import { protect } from '@/middlewares/authentication';

const router = express.Router();
const containerController = new ContainerController();

router.use(protect);

router.get('/', containerController.getAllContainers);
router.post('/', containerController.createContainer);
router.post('/:id/control', containerController.controlContainer);
router.delete('/:id', containerController.deleteContainer);
router.get('/:id/stats', containerController.getContainerStats);
router.post('/:id/restart', containerController.restartContainer);
router.patch('/:id', containerController.updateContainer);
router.get('/:id/files', containerController.getContainerFiles);
router.get('/:id/read', containerController.readContainerFile);
router.get('/:id/top', containerController.getContainerProcesses);

export default router;
