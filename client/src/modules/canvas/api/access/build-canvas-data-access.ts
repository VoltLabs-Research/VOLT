import canvasService from '@/modules/canvas/api/services/canvas-service';
import trajectoryService from '@/modules/trajectory/api/services/trajectory-service';
import simulationCellService from '@/modules/simulation-cell/api/service';
import sceneArtifactsService from '@/modules/trajectory/api/services/scene-artifacts-service';
import colorCodingService from '@/modules/trajectory/api/services/color-coding-service';
import particleFilterService from '@/modules/trajectory/api/services/particle-filter-service';
import pluginService from '@/modules/plugin/api/services/plugin-service';
import listingService from '@/modules/plugin/api/services/listing-service';
import analysisService from '@/modules/analysis/api/service';
import rasterService from '@/modules/raster/api/service';
import type { CanvasAccessState } from './types';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/api/services/trajectory-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SimulationCell } from '@/modules/simulation-cell/api/entities/simulation-cell';
import type { GetSimulationCellByTrajectoryParams } from '@/modules/simulation-cell/api/service';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '@/modules/trajectory/api/services/scene-artifacts-service';
import type {
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '@/modules/trajectory/api/services/color-coding-service';
import type {
    FilterPropertiesData,
    GetFilterPropertiesInputDTO,
    GetUniqueValuesInputDTO,
    GetUniqueValuesOutputDTO,
    PreviewFilterInputDTO,
    PreviewFilterOutputDTO
} from '@/modules/trajectory/api/services/particle-filter-service';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type {
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO
} from '@/modules/plugin/api/services/listing-service';
import type {
    GetSubListingInputDTO,
    GetSubListingOutputDTO
} from '@/modules/plugin/api/services/listing-service';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type {
    GetAnalysesByTrajectoryParams,
    GetAnalysisFrameLogParams,
    GetAnalysisFrameLogResponse
} from '@/modules/analysis/api/service';
import type {
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/service';

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
