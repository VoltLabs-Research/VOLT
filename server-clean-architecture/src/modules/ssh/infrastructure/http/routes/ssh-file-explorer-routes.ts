import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import ListSSHFilesController from '../controllers/ListSSHFilesController';

const listSSHFilesController = container.resolve(ListSSHFilesController);

const router = Router();

router.use(protect);

router.get('/:teamId/list', listSSHFilesController.handle);

export default router;
