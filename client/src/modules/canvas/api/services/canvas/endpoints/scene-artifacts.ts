import { get } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '@/modules/trajectory/api/dtos/scene-artifacts';

const buildSceneArtifactQuery = (
    params: Pick<ListSceneArtifactsInputDTO, 'analysisId' | 'projection' | 'timestep' | 'page' | 'limit' | 'sourceType' | 'type'>
) => {
    const sourceType = params.sourceType ?? params.type;
    return {
        ...(params.analysisId ? { analysisId: params.analysisId } : {}),
        ...(params.projection ? { projection: params.projection } : {}),
        ...(params.timestep !== undefined ? { timestep: params.timestep } : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(sourceType ? { sourceType } : {})
    };
};

export default {
    listSceneArtifacts: get<ListSceneArtifactsInputDTO, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        '/:trajectoryId/scene-artifacts',
        {
            unwrap: 'raw',
            omit: ['type'],
            query: buildSceneArtifactQuery
        }
    )
};
