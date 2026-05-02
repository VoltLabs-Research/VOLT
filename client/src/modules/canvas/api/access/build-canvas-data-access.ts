import canvasService from '@/modules/canvas/api/services/canvas';
import trajectoryService from '@/modules/trajectory/api/services/trajectory';
import simulationCellService from '@/modules/simulation-cell/api/service';
import sceneArtifactsService from '@/modules/trajectory/api/services/scene-artifacts';
import colorCodingService from '@/modules/trajectory/api/services/color-coding';
import particleFilterService from '@/modules/trajectory/api/services/particle-filter';
import pluginService from '@/modules/plugin/api/services/plugin';
import listingService from '@/modules/plugin/api/services/listing';
import analysisService from '@/modules/analysis/api/service';
import rasterService from '@/modules/raster/api/service';
import type { CanvasAccessState } from './types';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/api/dtos/trajectory';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { GetSimulationCellByTrajectoryParams } from '@/modules/simulation-cell/api/dtos/get-simulation-cell-by-trajectory';
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
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { GetAnalysesByTrajectoryParams } from '@/modules/analysis/api/dtos/get-analyses-by-trajectory';
import type {
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from '@/modules/analysis/api/dtos/get-analysis-frame-log';
import type {
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/dtos/get-raster-metadata';

interface TrajectoryScopedParams {
    trajectoryId: string;
}

export interface CanvasDataAccess {
    getAtoms: (params: GetAtomsInputDTO) => Promise<GetAtomsOutputDTO>;
    getSimulationCell: (params: GetSimulationCellByTrajectoryParams) => Promise<SimulationCell | null>;
    listSceneArtifacts: (params: ListSceneArtifactsInputDTO) => Promise<PaginatedResponse<SceneArtifact | RenderableExposurePayload>>;
    getColorCodingProperties: (params: GetColorCodingPropertiesInputDTO) => Promise<ColorCodingProperties>;
    getColorCodingStats: (params: GetColorCodingStatsInputDTO) => Promise<ColorCodingStats>;
    getParticleFilterProperties: (params: GetFilterPropertiesInputDTO) => Promise<FilterPropertiesData>;
    getParticleFilterUniqueValues: (params: GetUniqueValuesInputDTO) => Promise<GetUniqueValuesOutputDTO>;
    previewParticleFilter: (params: PreviewFilterInputDTO) => Promise<PreviewFilterOutputDTO>;
    getPluginById: (params: TrajectoryScopedParams & { pluginId: string }) => Promise<Plugin>;
    getPluginListing: (params: TrajectoryScopedParams & GetPluginListingInputDTO) => Promise<GetPluginListingOutputDTO>;
    getSubListing: (params: TrajectoryScopedParams & GetSubListingInputDTO) => Promise<GetSubListingOutputDTO>;
    getAnalysesByTrajectory: (params: GetAnalysesByTrajectoryParams) => Promise<PaginatedResponse<Analysis>>;
    getAnalysisFrameLog: (params: TrajectoryScopedParams & GetAnalysisFrameLogParams) => Promise<GetAnalysisFrameLogResponse>;
    getRasterMetadata: (params: GetRasterMetadataParams) => Promise<GetRasterMetadataResponse>;
}

const buildPublic = (): CanvasDataAccess => ({
    getAtoms: (params) => canvasService.getAtoms(params),
    getSimulationCell: (params) => canvasService.getSimulationCell(params),
    listSceneArtifacts: (params) => canvasService.listSceneArtifacts(params),
    getColorCodingProperties: (params) => canvasService.getColorCodingProperties(params),
    getColorCodingStats: (params) => canvasService.getColorCodingStats(params),
    getParticleFilterProperties: (params) => canvasService.getParticleFilterProperties(params),
    getParticleFilterUniqueValues: (params) => canvasService.getParticleFilterUniqueValues(params),
    previewParticleFilter: (params) => canvasService.getParticleFilterPreview(params),
    getPluginById: ({ trajectoryId, pluginId }) => canvasService.getPlugin({ trajectoryId, pluginId }),
    getPluginListing: (params) => canvasService.getPluginListing(params),
    getSubListing: (params) => canvasService.getSubListing(params),
    getAnalysesByTrajectory: ({ trajectoryId, page, limit }) => canvasService.listAnalyses({ trajectoryId, page, limit }),
    getAnalysisFrameLog: (params) => canvasService.getFrameLog(params),
    getRasterMetadata: (params) => canvasService.getRasterMetadata(params)
});

const buildRbac = (): CanvasDataAccess => ({
    getAtoms: (params) => trajectoryService.getAtoms(params),
    getSimulationCell: (params) => simulationCellService.getByTrajectory(params),
    listSceneArtifacts: (params) => sceneArtifactsService.listByTrajectory(params),
    getColorCodingProperties: (params) => colorCodingService.getProperties(params),
    getColorCodingStats: (params) => colorCodingService.getStats(params),
    getParticleFilterProperties: (params) => particleFilterService.getProperties(params),
    getParticleFilterUniqueValues: (params) => particleFilterService.getUniqueValues(params),
    previewParticleFilter: (params) => particleFilterService.preview(params),
    getPluginById: ({ pluginId }) => pluginService.getById({ _id: pluginId }),
    getPluginListing: ({ trajectoryId: _trajectoryId, ...rest }) => listingService.getListing(rest),
    getSubListing: ({ trajectoryId: _trajectoryId, ...rest }) => listingService.getSubListing(rest),
    getAnalysesByTrajectory: (params) => analysisService.getByTrajectoryId(params),
    getAnalysisFrameLog: ({ trajectoryId: _trajectoryId, ...rest }) => analysisService.getFrameLog(rest),
    getRasterMetadata: (params) => rasterService.getMetadata(params)
});

export const buildCanvasDataAccess = (state: CanvasAccessState): CanvasDataAccess => {
    return state.mode === 'public' ? buildPublic() : buildRbac();
};
