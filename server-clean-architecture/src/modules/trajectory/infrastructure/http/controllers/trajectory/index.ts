import CreateTrajectoryController from './CreateTrajectoryController';
import DeleteTrajectoryByIdController from './DeleteTrajectoryByIdController';
import GetTeamMetricsController from './GetTeamMetricsController';
import GetTrajectoriesByTeamIdController from './GetTrajectoriesByTeamIdController';
import GetTrajectoryByIdController from './GetTrajectoryByIdController';
import GetTrajectoryGLBController from './GetTrajectoryGLBController';
import GetTrajectoryPreviewController from './GetTrajectoryPreviewController';
import UpdateTrajectoryByIdController from './UpdateTrajectoryByIdController';
import GetAtomsController from './GetAtomsController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateTrajectoryController),
    deleteById: container.resolve(DeleteTrajectoryByIdController),
    getByTeamId: container.resolve(GetTrajectoriesByTeamIdController),
    getById: container.resolve(GetTrajectoryByIdController),
    updateById: container.resolve(UpdateTrajectoryByIdController),
    getGLB: container.resolve(GetTrajectoryGLBController),
    getPreview: container.resolve(GetTrajectoryPreviewController),
    getMetrics: container.resolve(GetTeamMetricsController),
    getAtoms: container.resolve(GetAtomsController)
};