import { createService, get, paginated } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SceneArtifact } from '../entities/scene-artifacts/scene-artifact';
import type { SceneArtifactSourceType } from '../entities/scene-artifacts/scene-artifact';

export interface RenderableExposurePayload {
    pluginId?: string;
    analysisId?: string;
    exposureId: string;
    modifierId?: string;
    name: string;
    icon?: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    };
}

export interface ListSceneArtifactsInputDTO {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    type?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}

export interface ListTeamSceneArtifactsInputDTO {
    page?: number;
    limit?: number;
    sourceType?: SceneArtifactSourceType;
    type?: SceneArtifactSourceType;
    analysisId?: string;
    timestep?: number;
}

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

export default createService({
    clients: {
        default: {
            basePath: '/trajectories',
            useRBAC: true
        }
    }
}, endpoints);
