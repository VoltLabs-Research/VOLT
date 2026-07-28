import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateTrajectoryUploadSessionInput,
    CloneTrajectoryInput,
    UpdateTrajectoryInput,
    MoveTrajectoryInput,
    CreateTrajectoryFolderInput,
    UpdateTrajectoryFolderInput,
    CreateColoredModelInput,
    ApplyParticleFilterActionInput,
    CreateLineStyledModelInput
} from './http';
import type {
    Trajectory,
    TrajectoryFolder,
    SceneArtifact,
    SampleSimulation,
    TeamMetricsResponse,
    CreateTrajectoryUploadSessionResponse,
    CommitTrajectoryUploadSessionResponse,
    CloneTrajectoryResponse,
    TrajectoryPreviewResponse,
    ColorCodingPropertiesResponse,
    ColorCodingStatsResponse,
    CreateColoredModelResponse,
    ParticleFilterPropertiesResponse,
    ParticleFilterUniqueValuesResponse,
    ParticleFilterPreviewResponse,
    ApplyParticleFilterActionResponse,
    CreateLineStyledModelResponse,
    GetLineEntityPropertiesResponse,
    CanvasBootstrapResponse,
    CanvasTrajectoryResponse,
    CanvasSimulationCellResponse,
    CanvasPluginResponse,
    CanvasSubListingResponse,
    CanvasFrameLogResponse,
    CanvasRasterMetadataResponse
} from './domain';

export const trajectoryRoutes = {
    
    listSamples: get<SampleSimulation[]>('/api/trajectories/:teamId/samples'),
    downloadSamples: get<unknown>('/api/trajectories/:teamId/samples/:filename'),
    listTeamSceneArtifacts: get<SceneArtifact>('/api/trajectories/:teamId/scene-artifacts'),
    createUploadSession: post<CreateTrajectoryUploadSessionInput, CreateTrajectoryUploadSessionResponse>('/api/trajectories/:teamId/upload-sessions'),
    commitUploadSession: post<never, CommitTrajectoryUploadSessionResponse>('/api/trajectories/:teamId/upload-sessions/:uploadSessionId/commit'),
    cancelUploadSession: del('/api/trajectories/:teamId/upload-sessions/:uploadSessionId'),
    list: get<Trajectory>('/api/trajectories/:teamId'),
    clone: post<CloneTrajectoryInput, CloneTrajectoryResponse>('/api/trajectories/:teamId/clones'),

    listFolders: get<TrajectoryFolder>('/api/trajectories/:teamId/folders'),
    getFolder: get<TrajectoryFolder>('/api/trajectories/:teamId/folders/:folderId'),
    createFolder: post<CreateTrajectoryFolderInput, TrajectoryFolder>('/api/trajectories/:teamId/folders'),
    updateFolder: patch<UpdateTrajectoryFolderInput, TrajectoryFolder>('/api/trajectories/:teamId/folders/:folderId'),
    removeFolder: del('/api/trajectories/:teamId/folders/:folderId'),

    getMetrics: get<TeamMetricsResponse>('/api/trajectories/:teamId/metrics'),
    getPreview: get<TrajectoryPreviewResponse>('/api/trajectories/:teamId/:trajectoryId/preview'),
    downloadAnalyses: get<unknown>('/api/trajectories/:teamId/:trajectoryId/analyses/download'),
    download: get<unknown>('/api/trajectories/:teamId/:trajectoryId/download'),
    getAtoms: get<unknown>('/api/trajectories/:teamId/:trajectoryId/frame/:timestep/atoms'),
    getSceneArtifacts: get<SceneArtifact>('/api/trajectories/:teamId/:trajectoryId/scene-artifacts'),
    move: patch<MoveTrajectoryInput, Trajectory>('/api/trajectories/:teamId/:trajectoryId/folder'),
    get: get<Trajectory>('/api/trajectories/:teamId/:trajectoryId'),
    update: patch<UpdateTrajectoryInput, Trajectory>('/api/trajectories/:teamId/:trajectoryId'),
    remove: del('/api/trajectories/:teamId/:trajectoryId'),

    
    colorCodingProperties: get<ColorCodingPropertiesResponse>('/api/color-codings/:teamId/:trajectoryId/properties'),
    colorCodingStats: get<ColorCodingStatsResponse>('/api/color-codings/:teamId/:trajectoryId/stats'),
    colorCodingModel: get<unknown>('/api/color-codings/:teamId/:trajectoryId'),
    colorCodingCreate: post<CreateColoredModelInput, CreateColoredModelResponse>('/api/color-codings/:teamId/:trajectoryId'),
    colorCodingPropertiesByAnalysis: get<ColorCodingPropertiesResponse>('/api/color-codings/:teamId/:trajectoryId/properties/:analysisId'),
    colorCodingStatsByAnalysis: get<ColorCodingStatsResponse>('/api/color-codings/:teamId/:trajectoryId/stats/:analysisId'),
    colorCodingModelByAnalysis: get<unknown>('/api/color-codings/:teamId/:trajectoryId/:analysisId'),
    colorCodingCreateByAnalysis: post<CreateColoredModelInput, CreateColoredModelResponse>('/api/color-codings/:teamId/:trajectoryId/:analysisId'),

    
    particleFilterProperties: get<ParticleFilterPropertiesResponse>('/api/particle-filters/:teamId/:trajectoryId/properties'),
    particleFilterPreview: get<ParticleFilterPreviewResponse>('/api/particle-filters/:teamId/:trajectoryId/previews'),
    particleFilterUniqueValues: get<ParticleFilterUniqueValuesResponse>('/api/particle-filters/:teamId/:trajectoryId/unique-values'),
    particleFilterModel: get<unknown>('/api/particle-filters/:teamId/:trajectoryId'),
    particleFilterApply: post<ApplyParticleFilterActionInput, ApplyParticleFilterActionResponse>('/api/particle-filters/:teamId/:trajectoryId'),
    particleFilterPropertiesByAnalysis: get<ParticleFilterPropertiesResponse>('/api/particle-filters/:teamId/:trajectoryId/properties/:analysisId'),
    particleFilterPreviewByAnalysis: get<ParticleFilterPreviewResponse>('/api/particle-filters/:teamId/:trajectoryId/previews/:analysisId'),
    particleFilterUniqueValuesByAnalysis: get<ParticleFilterUniqueValuesResponse>('/api/particle-filters/:teamId/:trajectoryId/unique-values/:analysisId'),
    particleFilterModelByAnalysis: get<unknown>('/api/particle-filters/:teamId/:trajectoryId/:analysisId'),
    particleFilterApplyByAnalysis: post<ApplyParticleFilterActionInput, ApplyParticleFilterActionResponse>('/api/particle-filters/:teamId/:trajectoryId/:analysisId'),

    
    lineStyleModel: get<unknown>('/api/line-styles/:teamId/:trajectoryId/:analysisId/:exposureId'),
    lineStyleCreate: post<CreateLineStyledModelInput, CreateLineStyledModelResponse>('/api/line-styles/:teamId/:trajectoryId/:analysisId/:exposureId'),
    lineStyleRanges: get<unknown>('/api/line-styles/:teamId/:trajectoryId/:analysisId/:exposureId/ranges'),
    lineStyleEntityProperties: get<GetLineEntityPropertiesResponse>('/api/line-styles/:teamId/:trajectoryId/:analysisId/:exposureId/entities/:entityId'),

    
    lodOctreeMetadata: get<unknown>('/api/lod/:teamId/:trajectoryId/:analysisId/:exposureId/octree-metadata'),

    
    discoverListPublicTrajectories: get<Trajectory>('/api/discover/teams/:teamId/trajectories'),

    
    canvasBootstrap: get<CanvasBootstrapResponse>('/api/canvas/:trajectoryId/bootstrap'),
    canvasTrajectory: get<CanvasTrajectoryResponse>('/api/canvas/:trajectoryId'),
    canvasPreview: get<TrajectoryPreviewResponse>('/api/canvas/:trajectoryId/preview'),
    canvasAnalyses: get<unknown>('/api/canvas/:trajectoryId/analyses'),
    canvasDump: get<unknown>('/api/canvas/:trajectoryId/dumps/:timestep'),
    canvasGlb: get<unknown>('/api/canvas/:trajectoryId/glb/:timestep/:analysisId'),
    canvasRasterFrame: get<unknown>('/api/canvas/:trajectoryId/frames/:timestep'),
    canvasRasterFrameModel: get<unknown>('/api/canvas/:trajectoryId/frames/:timestep/:analysisId/:model'),
    canvasAtoms: get<unknown>('/api/canvas/:trajectoryId/frame/:timestep/atoms'),
    canvasSimulationCell: get<CanvasSimulationCellResponse>('/api/canvas/:trajectoryId/simulation-cell'),
    canvasSceneArtifacts: get<SceneArtifact>('/api/canvas/:trajectoryId/scene-artifacts'),

    canvasColorCodingProperties: get<ColorCodingPropertiesResponse>('/api/canvas/:trajectoryId/color-coding/properties'),
    canvasColorCodingPropertiesByAnalysis: get<ColorCodingPropertiesResponse>('/api/canvas/:trajectoryId/color-coding/properties/:analysisId'),
    canvasColorCodingStats: get<ColorCodingStatsResponse>('/api/canvas/:trajectoryId/color-coding/stats'),
    canvasColorCodingStatsByAnalysis: get<ColorCodingStatsResponse>('/api/canvas/:trajectoryId/color-coding/stats/:analysisId'),
    canvasColorCodingModel: get<unknown>('/api/canvas/:trajectoryId/color-coding/model'),
    canvasColorCodingModelByAnalysis: get<unknown>('/api/canvas/:trajectoryId/color-coding/model/:analysisId'),

    canvasParticleFilterProperties: get<ParticleFilterPropertiesResponse>('/api/canvas/:trajectoryId/particle-filter/properties'),
    canvasParticleFilterPropertiesByAnalysis: get<ParticleFilterPropertiesResponse>('/api/canvas/:trajectoryId/particle-filter/properties/:analysisId'),
    canvasParticleFilterUniqueValues: get<ParticleFilterUniqueValuesResponse>('/api/canvas/:trajectoryId/particle-filter/unique-values'),
    canvasParticleFilterUniqueValuesByAnalysis: get<ParticleFilterUniqueValuesResponse>('/api/canvas/:trajectoryId/particle-filter/unique-values/:analysisId'),
    canvasParticleFilterPreview: get<ParticleFilterPreviewResponse>('/api/canvas/:trajectoryId/particle-filter/preview'),
    canvasParticleFilterPreviewByAnalysis: get<ParticleFilterPreviewResponse>('/api/canvas/:trajectoryId/particle-filter/preview/:analysisId'),
    canvasParticleFilterModel: get<unknown>('/api/canvas/:trajectoryId/particle-filter/model'),
    canvasParticleFilterModelByAnalysis: get<unknown>('/api/canvas/:trajectoryId/particle-filter/model/:analysisId'),

    canvasPlugin: get<CanvasPluginResponse>('/api/canvas/:trajectoryId/plugins/:pluginId'),
    canvasPluginListing: get<unknown>('/api/canvas/:trajectoryId/plugins/:pluginId/listings'),
    canvasSubListing: get<CanvasSubListingResponse>('/api/canvas/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'),
    canvasExposureGlb: get<unknown>('/api/canvas/:trajectoryId/exposures/:analysisId/:exposureId/:timestep/glb'),
    canvasFrameLog: get<CanvasFrameLogResponse>('/api/canvas/:trajectoryId/analyses/:analysisId/logs/:timestep'),
    canvasRasterMetadata: get<CanvasRasterMetadataResponse>('/api/canvas/:trajectoryId/raster-metadata')
} as const;
