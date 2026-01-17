import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { upload } from '@/src/shared/infrastructure/http/middleware/upload';
import CreateTrajectoryController from '../controllers/CreateTrajectoryController';
import DeleteTrajectoryByIdController from '../controllers/DeleteTrajectoryByIdController';
import GetTrajectoriesByTeamIdController from '../controllers/GetTrajectoriesByTeamIdController';
import GetTrajectoryByIdController from '../controllers/GetTrajectoryByIdController';
import UpdateTrajectoryByIdController from '../controllers/UpdateTrajectoryByIdController';
import GetTeamMetricsController from '../controllers/GetTeamMetricsController';
import GetTrajectoryPreviewController from '../controllers/GetTrajectoryPreviewController';
import GetTrajectoryGLBController from '../controllers/GetTrajectoryGLBController';

const createTrajectoryController = container.resolve(CreateTrajectoryController);
const deleteTrajectoryByIdController = container.resolve(DeleteTrajectoryByIdController);
const getTrajectoriesByTeamIdController = container.resolve(GetTrajectoriesByTeamIdController);
const getTrajectoryByIdController = container.resolve(GetTrajectoryByIdController);
const updateTrajectoryByIdController = container.resolve(UpdateTrajectoryByIdController);
const getTeamMetricsController = container.resolve(GetTeamMetricsController);
const getTrajectoryPreviewController = container.resolve(GetTrajectoryPreviewController);
const getTrajectoryGLBController = container.resolve(GetTrajectoryGLBController);

const router = Router();

router.use(protect);
router.get('/:teamId/:trajectoryId/:timestep/:analysisId', getTrajectoryGLBController.handle);

router.post('/:teamId', upload.array('trajectoryFiles'), createTrajectoryController.handle);
router.get('/:teamId/metrics', getTeamMetricsController.handle);
router.get('/:teamId', getTrajectoriesByTeamIdController.handle);

// Preview and GLB routes
router.get('/:teamId/:trajectoryId/preview', getTrajectoryPreviewController.handle);

router.route('/:teamId/:trajectoryId')
    .get(getTrajectoryByIdController.handle)
    .patch(updateTrajectoryByIdController.handle)
    .delete(deleteTrajectoryByIdController.handle);

export default router;