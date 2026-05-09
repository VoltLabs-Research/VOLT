import { createController, createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { GetTeamMetricsResultDTO } from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import CreateTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryUseCase';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';
import GetTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';
import CloneTrajectoryController from './CloneTrajectoryController';
import GetAtomsBinaryController from './GetAtomsBinaryController';
import GetTrajectoryPreviewController from './GetTrajectoryPreviewController';
import MoveTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/MoveTrajectoryUseCase';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryByIdUseCase';
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
const DeleteTrajectoryByIdController = createController(DeleteTrajectoryByIdUseCase, HttpStatus.NoContent);
const GetTeamMetricsController = createController(GetTeamMetricsUseCase, {
    handleSuccess: (_req, res, value) => {
        BaseResponse.success(res, presentTeamMetrics(value as GetTeamMetricsResultDTO));
    }
});
const GetTrajectoriesByTeamIdController = createPaginatedController(GetTrajectoriesByTeamIdUseCase);
const GetTrajectoryByIdController = createController(GetTrajectoryByIdUseCase);
const UpdateTrajectoryByIdController = createController(UpdateTrajectoryByIdUseCase);
const MoveTrajectoryController = createController(MoveTrajectoryUseCase);
const ListSampleSimulationsController = createController(ListSampleSimulationsUseCase);
const resolvedControllers = createControllerRegistry({
    getPreview: GetTrajectoryPreviewController,
    getSceneArtifacts: GetTrajectorySceneArtifactsController,
    listTeamSceneArtifacts: ListTeamSceneArtifactsController,
    downloadSamples: DownloadSampleSimulationsController,
    downloadTrajectoryAnalyses: DownloadTrajectoryAnalysesController,
    downloadTrajectory: DownloadTrajectoryController,
    cloneTrajectory: CloneTrajectoryController
});

export default {
    create: new CreateTrajectoryController(),
    deleteById: new DeleteTrajectoryByIdController(),
    getByTeamId: new GetTrajectoriesByTeamIdController(),
    getById: new GetTrajectoryByIdController(),
    updateById: new UpdateTrajectoryByIdController(),
    move: new MoveTrajectoryController(),
    getMetrics: new GetTeamMetricsController(),
    getAtomsBinary: new GetAtomsBinaryController(),
    ...resolvedControllers,
    listSamples: new ListSampleSimulationsController()
};
