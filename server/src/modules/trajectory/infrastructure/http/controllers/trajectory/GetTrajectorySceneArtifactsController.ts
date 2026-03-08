import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import {
    ListTrajectorySceneArtifactsUseCase
} from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
export default createPaginatedController(ListTrajectorySceneArtifactsUseCase, {
    extendParams: (_request, params) => {
        const { type, sourceType, ...rest } = params;

        return {
            ...rest,
            sourceType: sourceType ?? type
        };
    }
});
