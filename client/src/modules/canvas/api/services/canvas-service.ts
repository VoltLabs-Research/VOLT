import { createService, custom, download, get, paginated } from '@/app/core/http/utilities/create-service';
import { getAtomsBinary } from '@/modules/trajectory/api/services/atoms-binary-request';
import { mapRawListingResponse } from '@/modules/plugin/api/services/listing-response';
import { base64ToBlob } from '@/shared/utils/file';

import type { Trajectory } from '@/modules/trajectory/api/types/trajectory/trajectory';
import type { Analysis } from '@/modules/analysis/api/types/analysis';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { GetAtomsInput, GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';
import type { SimulationCell } from '@/modules/simulation-cell/api/types/simulation-cell';
import type { GetSimulationCellByTrajectoryParams } from '@/modules/simulation-cell/api/service';
import { buildSceneArtifactQuery } from '@/modules/trajectory/api/services/scene-artifacts-service';
import { buildPreviewQuery } from '@/modules/trajectory/api/services/particle-filter-service';
import type { SceneArtifact } from '@/modules/trajectory/api/types/scene-artifacts/scene-artifact';
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
import type { Plugin } from '@/modules/plugin/api/types/plugin/plugin';
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
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/service';
import type {
    GetPreviewInput,
    GetPreviewResponse
} from '@/modules/trajectory/api/services/trajectory-service';

export enum PublicCanvasAccessMode {
    ReadOnly = 'read-only'
}

export interface PublicCanvasFrame {
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
}

interface GetCanvasAnalysisRasterFrameParams extends GetCanvasRasterFrameParams {
    analysisId: string;
    model: string;
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
    getRasterFrame: download<GetCanvasRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep'),
    getAnalysisRasterFrame: download<GetCanvasAnalysisRasterFrameParams>('GET', '/:trajectoryId/frames/:timestep/:analysisId/:model'),
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
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/color-coding/properties/${analysisId}`
            : `/${trajectoryId}/color-coding/properties`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getColorCodingStats: get<GetColorCodingStatsInput, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/color-coding/stats/${analysisId}`
            : `/${trajectoryId}/color-coding/stats`,
        {
            omit: ['trajectoryId', 'analysisId']
        }
    ),
    getParticleFilterProperties: get<GetFilterPropertiesInput, FilterPropertiesData>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/properties/${analysisId}`
            : `/${trajectoryId}/particle-filter/properties`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getParticleFilterUniqueValues: get<GetUniqueValuesInput, GetUniqueValuesResponse>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/unique-values/${analysisId}`
            : `/${trajectoryId}/particle-filter/unique-values`,
        {
            omit: ['trajectoryId', 'analysisId']
        }
    ),
    getParticleFilterPreview: get<PreviewFilterInput, PreviewFilterResponse>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/preview/${analysisId}`
            : `/${trajectoryId}/particle-filter/preview`,
        {
            omit: ['trajectoryId', 'analysisId'],
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
            basePath: '/canvas',
            useRBAC: false
        }
    }
}, endpoints);
