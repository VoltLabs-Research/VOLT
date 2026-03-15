import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
export default createPaginatedController(ListTrajectorySceneArtifactsUseCase, {
    extendParams: (_request, params) => params
});
