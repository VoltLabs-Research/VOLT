import { createController, createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { GetTeamMetricsResultDTO } from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import CreateTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryUseCase';
import CreateTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryFolderUseCase';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import GetTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryFolderUseCase';
import GetTrajectoryGLBController from './GetTrajectoryGLBController';
import GetTrajectoryPreviewController from './GetTrajectoryPreviewController';
import ListTrajectoryFoldersUseCase from '@modules/trajectory/application/use-cases/trajectory/ListTrajectoryFoldersUseCase';
import MoveTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/MoveTrajectoryUseCase';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryByIdUseCase';
import UpdateTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryFolderUseCase';
import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';
import DownloadSampleSimulationsController from './DownloadSampleSimulationsController';
import DownloadTrajectoryAnalysesController from './DownloadTrajectoryAnalysesController';
import DownloadTrajectoryController from './DownloadTrajectoryController';
import ListSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/ListSampleSimulationsUseCase';
import GetTrajectorySceneArtifactsController from '@modules/trajectory/infrastructure/http/controllers/scene-artifacts/GetTrajectorySceneArtifactsController';
import ListTeamSceneArtifactsController from '@modules/trajectory/infrastructure/http/controllers/scene-artifacts/ListTeamSceneArtifactsController';
import { presentTeamMetrics } from '@modules/trajectory/infrastructure/http/presenters/trajectory';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const withAuthenticatedUserId = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...params,
    userId: req.userId
});

const CreateTrajectoryController = createController(CreateTrajectoryUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: withAuthenticatedUserId
});
const CreateTrajectoryFolderController = createController(CreateTrajectoryFolderUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: withAuthenticatedUserId
});
const DeleteTrajectoryByIdController = createController(DeleteTrajectoryByIdUseCase, HttpStatus.NoContent);
const DeleteTrajectoryFolderController = createController(DeleteTrajectoryFolderUseCase, {
    statusCode: HttpStatus.NoContent
});
const GetTeamMetricsController = createController(GetTeamMetricsUseCase, {
    handleSuccess: (res, value) => {
        BaseResponse.success(res, presentTeamMetrics(value as GetTeamMetricsResultDTO));
    }
});
const GetTrajectoriesByTeamIdController = createPaginatedController(GetTrajectoriesByTeamIdUseCase);
const GetTrajectoryByIdController = createController(GetTrajectoryByIdUseCase);
const GetTrajectoryFolderController = createController(GetTrajectoryFolderUseCase);
const UpdateTrajectoryByIdController = createController(UpdateTrajectoryByIdUseCase);
const UpdateTrajectoryFolderController = createController(UpdateTrajectoryFolderUseCase);
const MoveTrajectoryController = createController(MoveTrajectoryUseCase);
const GetAtomsController = createPaginatedController(GetAtomsUseCase);
const ListTrajectoryFoldersController = createPaginatedController(ListTrajectoryFoldersUseCase);
const ListSampleSimulationsController = createController(ListSampleSimulationsUseCase);
const resolvedControllers = createControllerRegistry({
    getGLB: GetTrajectoryGLBController,
    getPreview: GetTrajectoryPreviewController,
    getSceneArtifacts: GetTrajectorySceneArtifactsController,
    listTeamSceneArtifacts: ListTeamSceneArtifactsController,
    downloadSamples: DownloadSampleSimulationsController,
    downloadTrajectoryAnalyses: DownloadTrajectoryAnalysesController,
    downloadTrajectory: DownloadTrajectoryController
});

export default {
    create: new CreateTrajectoryController(),
    createFolder: new CreateTrajectoryFolderController(),
    deleteById: new DeleteTrajectoryByIdController(),
    deleteFolder: new DeleteTrajectoryFolderController(),
    getByTeamId: new GetTrajectoriesByTeamIdController(),
    getById: new GetTrajectoryByIdController(),
    getFolder: new GetTrajectoryFolderController(),
    updateById: new UpdateTrajectoryByIdController(),
    updateFolder: new UpdateTrajectoryFolderController(),
    move: new MoveTrajectoryController(),
    getMetrics: new GetTeamMetricsController(),
    getAtoms: new GetAtomsController(),
    listFolders: new ListTrajectoryFoldersController(),
    ...resolvedControllers,
    listSamples: new ListSampleSimulationsController()
};
