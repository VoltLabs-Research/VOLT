import { get, paginated } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SceneArtifact } from '../entities/scene-artifacts';
import type {
    ListSceneArtifactsInputDTO,
    ListTeamSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '../dtos/scene-artifacts';

export const buildSceneArtifactQuery = (
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

const buildTeamSceneArtifactQuery = (
    params: Pick<ListTeamSceneArtifactsInputDTO, 'analysisId' | 'timestep' | 'page' | 'limit' | 'sourceType' | 'type'>
) => {
    const sourceType = params.sourceType ?? params.type;
    return {
        ...(params.analysisId ? { analysisId: params.analysisId } : {}),
        ...(params.timestep !== undefined ? { timestep: params.timestep } : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(sourceType ? { sourceType } : {})
    };
};

const endpoints = {
    listByTrajectory: get<ListSceneArtifactsInputDTO, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        '/:trajectoryId/scene-artifacts', {
            unwrap: 'raw',
            omit: ['type'],
            query: buildSceneArtifactQuery
        }
    ),
    listByTeam: paginated<ListTeamSceneArtifactsInputDTO, PaginatedResponse<SceneArtifact>>('/scene-artifacts', {
        unwrap: 'raw',
        omit: ['type'],
        query: buildTeamSceneArtifactQuery
    })
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/trajectories',
            useRBAC: true
        }
    },
    endpoints
});
