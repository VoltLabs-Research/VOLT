import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import DeleteTrajectoryByIdController from '../controllers/DeleteTrajectoryByIdController';
import GetTrajectoriesByTeamIdController from '../controllers/GetTrajectoriesByTeamIdController';
import GetTrajectoryByIdController from '../controllers/GetTrajectoryByIdController';
import UpdateTrajectoryByIdController from '../controllers/UpdateTrajectoryByIdController';

const deleteTrajectoryByIdController = container.resolve(DeleteTrajectoryByIdController);
const getTrajectoriesByTeamIdController = container.resolve(GetTrajectoriesByTeamIdController);
const getTrajectoryByIdController = container.resolve(GetTrajectoryByIdController);
const updateTrajectoryByIdController = container.resolve(UpdateTrajectoryByIdController);

const router = Router();

router.use(protect);

router.get('/:teamId', getTrajectoriesByTeamIdController.handle);

router.route('/:trajectoryId')
    .get(getTrajectoryByIdController.handle)
    .patch(updateTrajectoryByIdController.handle)
    .delete(deleteTrajectoryByIdController.handle);

export default router;