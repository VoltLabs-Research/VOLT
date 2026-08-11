import { createService, paginated, serviceRoutes } from '@/app/core/http/utils/create-service';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

import type { PaginatedResponse } from '@voltstack/voltclient';
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

interface ListTeamSceneArtifactsInput {
    page?: number;
    limit?: number;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    timestep?: number;
}

export const buildSceneArtifactQuery = (
    params: Pick<ListSceneArtifactsInput, 'analysisId' | 'projection' | 'timestep' | 'page' | 'limit' | 'sourceType'>
) => {
    return {
        ...(params.analysisId ? { analysisId: params.analysisId } : {}),
        ...(params.projection ? { projection: params.projection } : {}),
        ...(params.timestep !== undefined ? { timestep: params.timestep } : {}),
        ...(params.page ? { page: params.page } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
        ...(params.sourceType ? { sourceType: params.sourceType } : {})
    };
};

const routes = serviceRoutes('/teams', { rbac: true });

const endpoints = {
    listByTrajectory: routes.route<ListSceneArtifactsInput, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        trajectoryRoutes.getSceneArtifacts, {
            unwrap: 'raw',
            query: buildSceneArtifactQuery
        }
    ),
    listByTeam: paginated<ListTeamSceneArtifactsInput, PaginatedResponse<SceneArtifact>>(routes.path(trajectoryRoutes.listTeamSceneArtifacts), {
        unwrap: 'raw',
        query: buildSceneArtifactQuery
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
