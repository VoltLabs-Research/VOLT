import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateTrajectoryUploadSessionInput,
    CloneTrajectoryInput,
    UpdateTrajectoryInput,
    MoveTrajectoryInput,
    CreateTrajectoryFolderInput,
    UpdateTrajectoryFolderInput,
    CreateColoredModelInput,
    ApplyParticleFilterActionInput
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
    CanvasBootstrapResponse,
    CanvasTrajectoryResponse,
    CanvasSimulationCellResponse,
    CanvasPluginResponse,
    CanvasSubListingResponse,
    CanvasFrameLogResponse,
    CanvasRasterMetadataResponse
} from './domain';

export const trajectoryRoutes = {
    
    listSamples: get<SampleSimulation[]>('/api/teams/:teamId/sample-simulations'),
    downloadSamples: get<unknown>('/api/teams/:teamId/sample-simulations/:filename'),
    listTeamSceneArtifacts: get<SceneArtifact>('/api/teams/:teamId/scene-artifacts'),
    createUploadSession: post<CreateTrajectoryUploadSessionInput, CreateTrajectoryUploadSessionResponse>('/api/teams/:teamId/trajectories/upload-sessions'),
    commitUploadSession: post<never, CommitTrajectoryUploadSessionResponse>('/api/teams/:teamId/trajectories/upload-sessions/:uploadSessionId/commits'),
    cancelUploadSession: del('/api/teams/:teamId/trajectories/upload-sessions/:uploadSessionId'),
    list: get<Trajectory>('/api/teams/:teamId/trajectories'),
    clone: post<CloneTrajectoryInput, CloneTrajectoryResponse>('/api/teams/:teamId/trajectories/clones'),

    listFolders: get<TrajectoryFolder>('/api/teams/:teamId/trajectory-folders'),
    getFolder: get<TrajectoryFolder>('/api/teams/:teamId/trajectory-folders/:folderId'),
    createFolder: post<CreateTrajectoryFolderInput, TrajectoryFolder>('/api/teams/:teamId/trajectory-folders'),
    updateFolder: patch<UpdateTrajectoryFolderInput, TrajectoryFolder>('/api/teams/:teamId/trajectory-folders/:folderId'),
    removeFolder: del('/api/teams/:teamId/trajectory-folders/:folderId'),

    getMetrics: get<TeamMetricsResponse>('/api/teams/:teamId/trajectory-metrics'),
    getPreview: get<TrajectoryPreviewResponse>('/api/teams/:teamId/trajectories/:trajectoryId/preview'),
    downloadAnalyses: get<unknown>('/api/teams/:teamId/trajectories/:trajectoryId/analyses/download'),
    download: get<unknown>('/api/teams/:teamId/trajectories/:trajectoryId/download'),
    getAtoms: get<unknown>('/api/teams/:teamId/trajectories/:trajectoryId/frames/:timestep/atoms'),
    getSceneArtifacts: get<SceneArtifact>('/api/teams/:teamId/trajectories/:trajectoryId/scene-artifacts'),
    move: patch<MoveTrajectoryInput, Trajectory>('/api/teams/:teamId/trajectories/:trajectoryId/folder'),
    get: get<Trajectory>('/api/teams/:teamId/trajectories/:trajectoryId'),
    update: patch<UpdateTrajectoryInput, Trajectory>('/api/teams/:teamId/trajectories/:trajectoryId'),
    remove: del('/api/teams/:teamId/trajectories/:trajectoryId'),

    
    colorCodingProperties: get<ColorCodingPropertiesResponse>('/api/teams/:teamId/trajectories/:trajectoryId/color-codings/properties'),
    colorCodingStats: get<ColorCodingStatsResponse>('/api/teams/:teamId/trajectories/:trajectoryId/color-codings/stats'),
    colorCodingModel: get<unknown>('/api/teams/:teamId/trajectories/:trajectoryId/color-codings/model'),
    colorCodingCreate: post<CreateColoredModelInput, CreateColoredModelResponse>('/api/teams/:teamId/trajectories/:trajectoryId/color-codings'),

    
    particleFilterProperties: get<ParticleFilterPropertiesResponse>('/api/teams/:teamId/trajectories/:trajectoryId/particle-filters/properties'),
    particleFilterPreview: get<ParticleFilterPreviewResponse>('/api/teams/:teamId/trajectories/:trajectoryId/particle-filters/previews'),
    particleFilterUniqueValues: get<ParticleFilterUniqueValuesResponse>('/api/teams/:teamId/trajectories/:trajectoryId/particle-filters/unique-values'),
    particleFilterModel: get<unknown>('/api/teams/:teamId/trajectories/:trajectoryId/particle-filters/model'),
    particleFilterApply: post<ApplyParticleFilterActionInput, ApplyParticleFilterActionResponse>('/api/teams/:teamId/trajectories/:trajectoryId/particle-filters'),

    
    lodOctreeMetadata: get<unknown>('/api/teams/:teamId/trajectories/:trajectoryId/analyses/:analysisId/exposures/:exposureId/octree-metadata'),

    
    discoverListPublicTrajectories: get<Trajectory>('/api/public/teams/:teamId/trajectories'),

    
    canvasBootstrap: get<CanvasBootstrapResponse>('/api/public/trajectories/:trajectoryId/bootstrap'),
    canvasTrajectory: get<CanvasTrajectoryResponse>('/api/public/trajectories/:trajectoryId'),
    canvasPreview: get<TrajectoryPreviewResponse>('/api/public/trajectories/:trajectoryId/preview'),
    canvasAnalyses: get<unknown>('/api/public/trajectories/:trajectoryId/analyses'),
    canvasDump: get<unknown>('/api/public/trajectories/:trajectoryId/dumps/:timestep'),
    canvasGlb: get<unknown>('/api/public/trajectories/:trajectoryId/frames/:timestep/glb'),
    canvasRasterFrame: get<unknown>('/api/public/trajectories/:trajectoryId/frames/:timestep/raster'),
    canvasAtoms: get<unknown>('/api/public/trajectories/:trajectoryId/frames/:timestep/atoms'),
    canvasSimulationCell: get<CanvasSimulationCellResponse>('/api/public/trajectories/:trajectoryId/simulation-cell'),
    canvasSceneArtifacts: get<SceneArtifact>('/api/public/trajectories/:trajectoryId/scene-artifacts'),

    canvasColorCodingProperties: get<ColorCodingPropertiesResponse>('/api/public/trajectories/:trajectoryId/color-codings/properties'),
    canvasColorCodingStats: get<ColorCodingStatsResponse>('/api/public/trajectories/:trajectoryId/color-codings/stats'),
    canvasColorCodingModel: get<unknown>('/api/public/trajectories/:trajectoryId/color-codings/model'),

    canvasParticleFilterProperties: get<ParticleFilterPropertiesResponse>('/api/public/trajectories/:trajectoryId/particle-filters/properties'),
    canvasParticleFilterUniqueValues: get<ParticleFilterUniqueValuesResponse>('/api/public/trajectories/:trajectoryId/particle-filters/unique-values'),
    canvasParticleFilterPreview: get<ParticleFilterPreviewResponse>('/api/public/trajectories/:trajectoryId/particle-filters/preview'),
    canvasParticleFilterModel: get<unknown>('/api/public/trajectories/:trajectoryId/particle-filters/model'),

    canvasPlugin: get<CanvasPluginResponse>('/api/public/trajectories/:trajectoryId/plugins/:pluginId'),
    canvasPluginListing: get<unknown>('/api/public/trajectories/:trajectoryId/plugins/:pluginId/listings'),
    canvasSubListing: get<CanvasSubListingResponse>('/api/public/trajectories/:trajectoryId/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName'),
    canvasExposureGlb: get<unknown>('/api/public/trajectories/:trajectoryId/exposures/:analysisId/:exposureId/:timestep/glb'),
    canvasFrameLog: get<CanvasFrameLogResponse>('/api/public/trajectories/:trajectoryId/analyses/:analysisId/logs/:timestep'),
    canvasRasterMetadata: get<CanvasRasterMetadataResponse>('/api/public/trajectories/:trajectoryId/raster-metadata')
} as const;
