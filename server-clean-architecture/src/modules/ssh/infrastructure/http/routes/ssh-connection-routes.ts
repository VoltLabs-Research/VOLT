import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import CreateSSHConnectionController from '../controllers/CreateSSHConnectionController';
import DeleteSSHConnectionByIdController from '../controllers/DeleteSSHConnectionByIdController';
import TestSSHConnectionByIdController from '../controllers/TestSSHConnectionByIdController';
import UpdateSSHConnectionByIdController from '../controllers/UpdateSSHConnectionByIdController';
import GetSSHConnectionsByTeamIdController from '../controllers/GetSSHConnectionsByTeamIdController';

const createSSHConnectionController = container.resolve(CreateSSHConnectionController);
const deleteSSHConnectionByIdController = container.resolve(DeleteSSHConnectionByIdController);
const getSSHConnectionByTeamIdController = container.resolve(GetSSHConnectionsByTeamIdController);
const updateSSHConnectionByIdController = container.resolve(UpdateSSHConnectionByIdController);
const testSSHConnectionByIdController = container.resolve(TestSSHConnectionByIdController);

const router = Router();

router.use(protect);

router.route('/')
    .get(getSSHConnectionByTeamIdController.handle)
    .post(createSSHConnectionController.handle);

router.route('/:sshConnectionId')
    .patch(updateSSHConnectionByIdController.handle)
    .delete(deleteSSHConnectionByIdController.handle);

router.get('/:sshConnectionId/test', testSSHConnectionByIdController.handle);

export default router;