import { createService, custom, download, get, paginated } from '@/app/core/http/utils/create-service';
import { getAtomsBinary } from '@/modules/trajectory/api/services/atoms-binary-request';
import { mapRawListingResponse } from '@/modules/plugin/api/services/listing-response';
import { base64ToBlob } from '@/shared/utils/file';

import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
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
import type { GetRasterMetadataParams } from '@/modules/raster/api/service';
import type { GetRasterMetadataResponse } from '@volt/contracts/modules/raster/domain';
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

export interface PublicCanvasTrajectory {
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
    isGuest: boolean;
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

interface GetCanvasRasterFrameParams {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
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

const endpoints = {
    getBootstrap: get<GetPublicCanvasBootstrapInput, GetPublicCanvasBootstrapOutput>('/:trajectoryId/bootstrap'),
    getTrajectory: get<GetCanvasTrajectoryParams, Trajectory>('/:trajectoryId'),
    getPreview: get<GetPreviewInput, GetPreviewResponse, string>('/:trajectoryId/preview', {
        query: ({ frame, quality }) => ({
            ...(frame !== undefined ? { frame } : {}),
            ...(quality ? { quality } : {})
        }),
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    listAnalyses: paginated<ListCanvasAnalysesParams, PaginatedResponse<Analysis>>('/:trajectoryId/analyses', {
        omit: ['trajectoryId'],
        query: ({ page, limit }) => ({
            ...(page !== undefined ? { page } : {}),
            ...(limit !== undefined ? { limit } : {})
        })
    }),
    getRasterFrame: download<GetCanvasRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep/raster'),
    getDump: download<GetCanvasDumpParams>('GET', '/:trajectoryId/dumps/:timestep'),
    getAtoms: custom<GetAtomsInput, GetAtomsResponse>(getAtomsBinary),
    getSimulationCell: get<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        '/:trajectoryId/simulation-cell',
        {
            omit: ['trajectoryId'],
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    ),
    listSceneArtifacts: get<ListSceneArtifactsInput, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        '/:trajectoryId/scene-artifacts',
        {
            unwrap: 'raw',
            query: buildSceneArtifactQuery
        }
    ),
    getColorCodingProperties: get<GetColorCodingPropertiesInput, ColorCodingProperties>(
        '/:trajectoryId/color-codings/properties',
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    getColorCodingStats: get<GetColorCodingStatsInput, ColorCodingStats>(
        '/:trajectoryId/color-codings/stats'
    ),
    getParticleFilterProperties: get<GetFilterPropertiesInput, FilterPropertiesData>(
        '/:trajectoryId/particle-filters/properties',
        {
            query: ({ timestep, analysisId }) => ({
                timestep,
                analysisId
            })
        }
    ),
    getParticleFilterUniqueValues: get<GetUniqueValuesInput, GetUniqueValuesResponse>(
        '/:trajectoryId/particle-filters/unique-values'
    ),
    getParticleFilterPreview: get<PreviewFilterInput, PreviewFilterResponse>(
        '/:trajectoryId/particle-filters/preview',
        {
            query: buildPreviewQuery
        }
    ),
    getPlugin: get<PublicCanvasPluginInput, Plugin>('/:trajectoryId/plugins/:pluginId'),
    getPluginListing: get<PublicCanvasListingInput, GetPluginListingResponse, RawListingResponse>(
        '/:trajectoryId/plugins/:pluginId/listings',
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
    getSubListing: get<PublicCanvasSubListingInput, GetSubListingResponse>(
        '/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'
    ),
    getFrameLog: get<PublicCanvasFrameLogParams, GetAnalysisFrameLogResponse>(
        '/:trajectoryId/analyses/:analysisId/logs/:timestep',
        {
            omit: ['trajectoryId', 'analysisId', 'timestep'],
            query: ({ afterCursor }) => afterCursor === undefined ? undefined : { afterCursor }
        }
    ),
    getRasterMetadata: get<GetRasterMetadataParams, GetRasterMetadataResponse>('/:trajectoryId/raster-metadata')
};

export default createService({
    clients: {
        default: {
            basePath: '/public/trajectories',
            useRBAC: false
        }
    }
}, endpoints);
