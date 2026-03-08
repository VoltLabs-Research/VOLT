import { get } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SceneArtifact } from '../../../entities/scene-artifact';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '../../../dtos/list-scene-artifacts';

const endpoints = {
    listByTrajectory: get<ListSceneArtifactsInputDTO, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        '/:trajectoryId/scene-artifacts', {
            unwrap: 'raw',
            omit: ['type'],
            query: (params) => {
                const sourceType = params.sourceType ?? params.type;
                return {
                    ...(params.analysisId ? { analysisId: params.analysisId } : {}),
                    ...(params.projection ? { projection: params.projection } : {}),
                    ...(params.timestep !== undefined ? { timestep: params.timestep } : {}),
                    ...(params.page ? { page: params.page } : {}),
                    ...(params.limit ? { limit: params.limit } : {}),
                    ...(sourceType ? { sourceType } : {})
                };
            }
        }
    )
};

export default endpoints;
