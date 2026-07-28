import { createService, get, paginated } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { SceneArtifact } from '@volt/contracts/modules/trajectory/domain';
import type { SceneArtifactSourceType } from '@volt/contracts/modules/trajectory/domain';

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

export interface ListSceneArtifactsInput {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}

export interface ListTeamSceneArtifactsInput {
    page?: number;
    limit?: number;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    timestep?: number;
}

export const buildSceneArtifactQuery = (
    params: Pick<ListSceneArtifactsInput, 'analysisId' | 'projection' | 'timestep' | 'page' | 'limit' | 'sourceType'>
) => {
    const sourceType = params.sourceType;
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
    params: Pick<ListTeamSceneArtifactsInput, 'analysisId' | 'timestep' | 'page' | 'limit' | 'sourceType'>
) => {
    const sourceType = params.sourceType;
    return {
        ...(params.analysisId ? { analysisId: params.analysisId } : {}),
        ...(params.timestep !== undefined ? { timestep: params.timestep } : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(sourceType ? { sourceType } : {})
    };
};

const endpoints = {
    listByTrajectory: get<ListSceneArtifactsInput, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        '/trajectories/:trajectoryId/scene-artifacts', {
            unwrap: 'raw',
            query: buildSceneArtifactQuery
        }
    ),
    listByTeam: paginated<ListTeamSceneArtifactsInput, PaginatedResponse<SceneArtifact>>('/scene-artifacts', {
        unwrap: 'raw',
        query: buildTeamSceneArtifactQuery
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
