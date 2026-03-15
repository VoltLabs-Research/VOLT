import { ListTeamSceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTeamSceneArtifactsUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

export default createPaginatedController(ListTeamSceneArtifactsUseCase, {
    extendParams: (_request, params) => params
});
