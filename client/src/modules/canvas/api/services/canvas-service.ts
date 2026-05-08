import { createService, custom, download, get, paginated } from '@/app/core/http/utilities/create-service';
import { getAtomsBinary } from '@/modules/trajectory/api/services/atoms-binary-request';
import { mapRawListingResponse } from '@/modules/plugin/api/services/listing-response';

import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type {
    GetPublicCanvasBootstrapInput,
    GetPublicCanvasBootstrapOutput
} from '@/modules/canvas/api/dtos/bootstrap';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/api/dtos/trajectory';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { GetSimulationCellByTrajectoryParams } from '@/modules/simulation-cell/api/dtos/get-simulation-cell-by-trajectory';
import { buildSceneArtifactQuery } from '@/modules/trajectory/api/services/scene-artifacts-service';
import { buildPreviewQuery } from '@/modules/trajectory/api/services/particle-filter-service';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '@/modules/trajectory/api/dtos/scene-artifacts';
import type {
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '@/modules/trajectory/api/dtos/color-coding';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO
} from '@/modules/trajectory/api/dtos/particle-filter';
import type { Plugin } from '@/modules/plugin/api/entities/plugin';
import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO
} from '@/modules/plugin/api/dtos/listing/get-plugin-listing';
import type {
    GetSubListingInputDTO,
    GetSubListingOutputDTO
} from '@/modules/plugin/api/dtos/listing/get-sub-listing';
import type { RawListingResponse } from '@/modules/plugin/api/services/listing-response';
import type {
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from '@/modules/analysis/api/dtos/get-analysis-frame-log';
import type {
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/dtos/get-raster-metadata';

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

interface PublicCanvasListingInput extends GetPluginListingInputDTO {
    trajectoryId: string;
}

interface PublicCanvasSubListingInput extends GetSubListingInputDTO {
    trajectoryId: string;
}

interface PublicCanvasFrameLogParams extends GetAnalysisFrameLogParams {
    trajectoryId: string;
}

const endpoints = {
    getBootstrap: get<GetPublicCanvasBootstrapInput, GetPublicCanvasBootstrapOutput>('/:trajectoryId/bootstrap'),
    getTrajectory: get<GetCanvasTrajectoryParams, Trajectory>('/:trajectoryId'),
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
    getAtoms: custom<GetAtomsInputDTO, GetAtomsOutputDTO>(getAtomsBinary),
    getSimulationCell: get<GetSimulationCellByTrajectoryParams, SimulationCell | null>(
        '/:trajectoryId/simulation-cell',
        {
            omit: ['trajectoryId'],
            query: ({ timestep }) => timestep === undefined ? undefined : { timestep }
        }
    ),
    listSceneArtifacts: get<ListSceneArtifactsInputDTO, PaginatedResponse<SceneArtifact | RenderableExposurePayload>>(
        '/:trajectoryId/scene-artifacts',
        {
            unwrap: 'raw',
            omit: ['type'],
            query: buildSceneArtifactQuery
        }
    ),
    getColorCodingProperties: get<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/color-coding/properties/${analysisId}`
            : `/${trajectoryId}/color-coding/properties`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getColorCodingStats: get<GetColorCodingStatsInputDTO, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/color-coding/stats/${analysisId}`
            : `/${trajectoryId}/color-coding/stats`,
        {
            omit: ['trajectoryId', 'analysisId']
        }
    ),
    getParticleFilterProperties: get<GetFilterPropertiesInputDTO, FilterPropertiesData>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/properties/${analysisId}`
            : `/${trajectoryId}/particle-filter/properties`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getParticleFilterUniqueValues: get<GetUniqueValuesInputDTO, GetUniqueValuesOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/unique-values/${analysisId}`
            : `/${trajectoryId}/particle-filter/unique-values`,
        {
            omit: ['trajectoryId', 'analysisId']
        }
    ),
    getParticleFilterPreview: get<PreviewFilterInputDTO, PreviewFilterOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/particle-filter/preview/${analysisId}`
            : `/${trajectoryId}/particle-filter/preview`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: buildPreviewQuery
        }
    ),
    getPlugin: get<PublicCanvasPluginInput, Plugin>('/:trajectoryId/plugins/:pluginId'),
    getPluginListing: get<PublicCanvasListingInput, GetPluginListingOutputDTO, RawListingResponse>(
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
    getSubListing: get<PublicCanvasSubListingInput, GetSubListingOutputDTO>(
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
