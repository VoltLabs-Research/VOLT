import { createService, custom, download, paginated, serviceRoutes } from '@/app/core/http/utils/create-service';
import { getAtomsBinary } from '@/modules/trajectory/api/services/atoms-binary-request';
import { mapRawListingResponse } from '@/modules/plugin/api/services/listing-response';
import { base64ToBlob } from '@/shared/utils/file';
import { trajectoryRoutes } from '@volt/contracts/modules/trajectory/routes';

import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { GetAtomsInput, GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';
import type { SimulationCell } from '@volt/contracts/modules/simulation-cell/domain';
import type { GetSimulationCellByTrajectoryParams } from '@/modules/simulation-cell/api/service';
import { buildSceneArtifactQuery } from '@/modules/trajectory/api/services/scene-artifacts-service';
import { buildPreviewQuery } from '@/modules/trajectory/api/services/particle-filter-service';
import type { SceneArtifact } from '@volt/contracts/modules/trajectory/domain';
import type {
    ListSceneArtifactsInput,
    RenderableExposurePayload
} from '@/modules/trajectory/api/services/scene-artifacts-service';
import type {
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInput,
    GetColorCodingStatsInput
} from '@/modules/trajectory/api/services/color-coding-service';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInput,
    GetUniqueValuesInput,
    GetUniqueValuesResponse,
    PreviewFilterInput,
    PreviewFilterResponse
} from '@/modules/trajectory/api/services/particle-filter-service';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type {
    GetPluginListingInput,
    GetPluginListingResponse
} from '@/modules/plugin/api/services/listing-service';
import type {
    GetSubListingInput,
    GetSubListingResponse
} from '@/modules/plugin/api/services/listing-service';
import type { RawListingResponse } from '@/modules/plugin/api/services/listing-response';
import type {
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from '@/modules/analysis/api/service';
import type {
    GetPreviewInput,
    GetPreviewResponse
} from '@/modules/trajectory/api/services/trajectory-service';

enum PublicCanvasAccessMode {
    ReadOnly = 'read-only'
}

interface PublicCanvasFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
}

interface PublicCanvasTrajectory {
    _id: string;
    name: string;
    status: string;
    isPublic: boolean;
    teamId: string;
    analysisIds: string[];
    frames: PublicCanvasFrame[];
}

export interface PublicCanvasAccess {
    mode: PublicCanvasAccessMode;
    isPublic: boolean;
    hasTeamMembership: boolean;
}

export interface GetPublicCanvasBootstrapInput {
    trajectoryId: string;
}

export interface GetPublicCanvasBootstrapOutput {
    access: PublicCanvasAccess;
    trajectory: PublicCanvasTrajectory;
}

interface GetCanvasTrajectoryParams {
    trajectoryId: string;
}

interface ListCanvasAnalysesParams {
    trajectoryId: string;
    page?: number;
    limit?: number;
}

interface GetCanvasDumpParams {
    trajectoryId: string;
    timestep: number | string;
}

interface PublicCanvasPluginInput {
    trajectoryId: string;
    pluginId: string;
}

interface PublicCanvasListingInput extends GetPluginListingInput {
    trajectoryId: string;
}

interface PublicCanvasSubListingInput extends GetSubListingInput {
    trajectoryId: string;
}

interface PublicCanvasFrameLogParams extends GetAnalysisFrameLogParams {
    trajectoryId: string;
}

const routes = serviceRoutes('/public/trajectories');

const endpoints = {
    getBootstrap: routes.route<GetPublicCanvasBootstrapInput, GetPublicCanvasBootstrapOutput>(trajectoryRoutes.canvasBootstrap),
    getTrajectory: routes.route<GetCanvasTrajectoryParams, Trajectory>(trajectoryRoutes.canvasTrajectory),
    getPreview: routes.route<GetPreviewInput, GetPreviewResponse, string>(trajectoryRoutes.canvasPreview, {
        query: ({ frame, quality }) => ({
            ...(frame !== undefined ? { frame } : {}),
            ...(quality ? { quality } : {})
        }),
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    listAnalyses: paginated<ListCanvasAnalysesParams, PaginatedResponse<Analysis>>(routes.path(trajectoryRoutes.canvasAnalyses), {
        omit: ['trajectoryId'],
        query: ({ page, limit }) => ({
            ...(page !== undefined ? { page } : {}),
            ...(limit !== undefined ? { limit } : {})
        })
    }),
    getDump: download<GetCanvasDumpParams>('GET', routes.path(trajectoryRoutes.canvasDump)),
    getAtoms: custom<GetAtomsInput, GetAtomsResponse>(getAtomsBinary),
    getSimulationCell: routes.route<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        trajectoryRoutes.canvasSimulationCell,
        {
            omit: ['trajectoryId'],
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    ),
    listSceneArtifacts: routes.route<ListSceneArtifactsInput, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        trajectoryRoutes.canvasSceneArtifacts,
        {
            unwrap: 'raw',
            query: buildSceneArtifactQuery
        }
    ),
    getColorCodingProperties: routes.route<GetColorCodingPropertiesInput, ColorCodingProperties>(
        trajectoryRoutes.canvasColorCodingProperties,
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    getColorCodingStats: routes.route<GetColorCodingStatsInput, ColorCodingStats>(
        trajectoryRoutes.canvasColorCodingStats
    ),
    getParticleFilterProperties: routes.route<GetFilterPropertiesInput, FilterPropertiesData>(
        trajectoryRoutes.canvasParticleFilterProperties,
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    getParticleFilterUniqueValues: routes.route<GetUniqueValuesInput, GetUniqueValuesResponse>(
        trajectoryRoutes.canvasParticleFilterUniqueValues
    ),
    getParticleFilterPreview: routes.route<PreviewFilterInput, PreviewFilterResponse>(
        trajectoryRoutes.canvasParticleFilterPreview,
        {
            query: buildPreviewQuery
        }
    ),
    getPlugin: routes.route<PublicCanvasPluginInput, Plugin>(trajectoryRoutes.canvasPlugin),
    getPluginListing: routes.route<PublicCanvasListingInput, GetPluginListingResponse, RawListingResponse>(
        trajectoryRoutes.canvasPluginListing,
        {
            unwrap: 'raw',
            omit: ['trajectoryId', 'pluginId'],
            query: (params) => ({
                ...(params.exposureId ? { exposureId: params.exposureId } : {}),
                ...(params.exposureName ? { exposureName: params.exposureName } : {}),
                ...(params.analysisId ? { analysisId: params.analysisId } : {}),
                ...(params.page !== undefined ? { page: params.page } : {}),
                ...(params.limit !== undefined ? { limit: params.limit } : {})
            }),
            map: mapRawListingResponse
        }
    ),
    getSubListing: routes.route<PublicCanvasSubListingInput, GetSubListingResponse>(
        trajectoryRoutes.canvasSubListing
    ),
    getFrameLog: routes.route<PublicCanvasFrameLogParams, GetAnalysisFrameLogResponse>(
        trajectoryRoutes.canvasFrameLog,
        {
            omit: ['trajectoryId', 'analysisId', 'timestep'],
            query: ({ afterCursor }) => afterCursor === undefined ? undefined : { afterCursor }
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/public/trajectories',
            useRBAC: false
        }
    }
}, endpoints);
