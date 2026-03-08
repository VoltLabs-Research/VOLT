import { createController, createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import CreateTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryUseCase';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import GetTrajectoryGLBController from './GetTrajectoryGLBController';
import GetTrajectoryPreviewController from './GetTrajectoryPreviewController';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryByIdUseCase';
import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import DownloadSampleSimulationsController from './DownloadSampleSimulationsController';
import DownloadTrajectoryController from './DownloadTrajectoryController';
import ListSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/ListSampleSimulationsUseCase';
import GetTrajectorySceneArtifactsController from './GetTrajectorySceneArtifactsController';
import { presentTeamMetrics } from './presentTeamMetrics';
import { container } from 'tsyringe';

const CreateTrajectoryController = createController(CreateTrajectoryUseCase, HttpStatus.Created);
const DeleteTrajectoryByIdController = createController(DeleteTrajectoryByIdUseCase, HttpStatus.NoContent);
const GetTeamMetricsController = createController(GetTeamMetricsUseCase, {
    handleSuccess: (res, value) => {
        BaseResponse.success(res, presentTeamMetrics(value));
    }
});
const GetTrajectoriesByTeamIdController = createPaginatedController(GetTrajectoriesByTeamIdUseCase);
const GetTrajectoryByIdController = createController(GetTrajectoryByIdUseCase);
const UpdateTrajectoryByIdController = createController(UpdateTrajectoryByIdUseCase);
const GetAtomsController = createPaginatedController(GetAtomsUseCase);
const ListSampleSimulationsController = createController(ListSampleSimulationsUseCase);

export default {
    create: new CreateTrajectoryController(),
    deleteById: new DeleteTrajectoryByIdController(),
    getByTeamId: new GetTrajectoriesByTeamIdController(),
    getById: new GetTrajectoryByIdController(),
    updateById: new UpdateTrajectoryByIdController(),
    getGLB: container.resolve(GetTrajectoryGLBController),
    getPreview: container.resolve(GetTrajectoryPreviewController),
    getMetrics: new GetTeamMetricsController(),
    getAtoms: new GetAtomsController(),
    getSceneArtifacts: container.resolve(GetTrajectorySceneArtifactsController),
    downloadSamples: container.resolve(DownloadSampleSimulationsController),
    downloadTrajectory: container.resolve(DownloadTrajectoryController),
    listSamples: new ListSampleSimulationsController()
};
