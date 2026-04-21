import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as trajectoryAiTools from '@modules/trajectory/application/ai-tools/trajectory';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';
import { ApplyParticleFilterActionUseCase } from '@modules/trajectory/application/use-cases/particle-filter/ApplyParticleFilterActionUseCase';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';
import { GetParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterPropertiesUseCase';
import { GetParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetParticleFilterUniqueValuesUseCase';
import { PreviewParticleFilterUseCase } from '@modules/trajectory/application/use-cases/particle-filter/PreviewParticleFilterUseCase';
import { ListTrajectorySceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/scene-artifacts/ListTrajectorySceneArtifactsUseCase';
import { GetPublicCanvasBootstrapUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasBootstrapUseCase';
import { GetPublicCanvasDumpUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasDumpUseCase';
import { GetPublicCanvasGLBUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasGLBUseCase';
import { GetPublicCanvasPreviewUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPreviewUseCase';
import { GetPublicCanvasRasterFrameUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasRasterFrameUseCase';
import { GetPublicCanvasTrajectoryUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasTrajectoryUseCase';
import { ListPublicCanvasAnalysesUseCase } from '@modules/trajectory/application/use-cases/canvas/ListPublicCanvasAnalysesUseCase';
import { GetPublicCanvasAtomsUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasAtomsUseCase';
import { GetPublicCanvasSimulationCellUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasSimulationCellUseCase';
import { ListPublicCanvasSceneArtifactsUseCase } from '@modules/trajectory/application/use-cases/canvas/ListPublicCanvasSceneArtifactsUseCase';
import { GetPublicCanvasColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColorCodingPropertiesUseCase';
import { GetPublicCanvasColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColorCodingStatsUseCase';
import { GetPublicCanvasColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasColoredModelStreamUseCase';
import { GetPublicCanvasParticleFilterPropertiesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterPropertiesUseCase';
import { GetPublicCanvasParticleFilterUniqueValuesUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterUniqueValuesUseCase';
import { GetPublicCanvasParticleFilterPreviewUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasParticleFilterPreviewUseCase';
import { GetPublicCanvasFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasFilteredModelStreamUseCase';
import { GetPublicCanvasPluginUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginUseCase';
import { GetPublicCanvasPluginListingUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginListingUseCase';
import { GetPublicCanvasSubListingUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasSubListingUseCase';
import { GetPublicCanvasPluginExposureGLBUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasPluginExposureGLBUseCase';
import { GetPublicCanvasAnalysisFrameLogUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasAnalysisFrameLogUseCase';
import { GetPublicCanvasRasterMetadataUseCase } from '@modules/trajectory/application/use-cases/canvas/GetPublicCanvasRasterMetadataUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import TrajectoryCloneCoordinator from '@modules/trajectory/application/services/TrajectoryCloneCoordinator';
import TrajectoryCloneRunner from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryCloneRunner';
import TrajectoryCloneJobRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryCloneJobRepository';
import CloneTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CloneTrajectoryUseCase';
import JobStatusChangedEventHandler from '@modules/trajectory/application/events/JobStatusChangedEventHandler';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';
import CloudUploadQueueService from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadQueueService';
import CompressionProcessor from '@modules/trajectory/infrastructure/services/trajectory/CompressionProcessor';
import CompressionQueueService from '@modules/trajectory/infrastructure/services/trajectory/CompressionQueueService';
import AtomPropertiesService from '@modules/trajectory/infrastructure/services/trajectory/AtomPropertiesService';
import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';
import ParticleFilterService from '@modules/trajectory/infrastructure/services/particle-filter/ParticleFilterService';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import TeamMetricsQueryService from '@modules/trajectory/infrastructure/services/trajectory/TeamMetricsQueryService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryBackgroundProcessor';
import TeamClusterQueueScopeLimitsService from '@modules/trajectory/infrastructure/services/trajectory/TeamClusterQueueScopeLimitsService';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import TrajectoryReader from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryReader';
import TrajectoryUploadStagingService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryUploadStagingService';
import CreateTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryFolderUseCase';
import DeleteTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryFolderUseCase';
import GetTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryFolderUseCase';
import ListTrajectoryFoldersUseCase from '@modules/trajectory/application/use-cases/trajectory/ListTrajectoryFoldersUseCase';
import MoveTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/MoveTrajectoryUseCase';
import UpdateTrajectoryFolderUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryFolderUseCase';
import TrajectoryFolderRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFolderRepository';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryPresenceSocketModule from '@modules/trajectory/infrastructure/socket/TrajectoryPresenceSocketModule';
import CanvasWorkspaceSocketModule from '@modules/trajectory/infrastructure/socket/CanvasWorkspaceSocketModule';
import CanvasWorkspaceRealtimeStateService from '@modules/trajectory/infrastructure/services/canvas/CanvasWorkspaceRealtimeStateService';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { createClassBindings } from '@shared/infrastructure/di/ModuleManifest';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const trajectoryDIManifest: ModuleManifest = {
    name: 'trajectory',
    singletons: [
        [TRAJECTORY_TOKENS.TrajectoryRepository, TrajectoryRepository],
        [TRAJECTORY_TOKENS.TrajectoryFrameRepository, TrajectoryFrameRepository],
        [TRAJECTORY_TOKENS.TrajectoryFolderRepository, TrajectoryFolderRepository],
        [TRAJECTORY_TOKENS.TeamMetricsQueryService, TeamMetricsQueryService],
        [TRAJECTORY_TOKENS.SceneArtifactRepository, SceneArtifactRepository],
        [TRAJECTORY_TOKENS.CompressionProcessor, CompressionProcessor],
        [TRAJECTORY_TOKENS.CompressionQueueService, CompressionQueueService],
        [TRAJECTORY_TOKENS.TeamClusterQueueScopeLimitsService, TeamClusterQueueScopeLimitsService],
        [TRAJECTORY_TOKENS.CloudUploadProcessor, CloudUploadProcessor],
        [TRAJECTORY_TOKENS.CloudUploadQueueService, CloudUploadQueueService],
        [TRAJECTORY_TOKENS.TrajectoryNativeDaemonService, TrajectoryNativeDaemonService],
        [TRAJECTORY_TOKENS.TrajectoryDumpStorageService, TrajectoryDumpStorageService],
        [TRAJECTORY_TOKENS.TrajectoryUploadStagingService, TrajectoryUploadStagingService],
        [TRAJECTORY_TOKENS.TrajectoryReader, TrajectoryReader],
        [TRAJECTORY_TOKENS.TrajectoryBackgroundProcessor, TrajectoryBackgroundProcessor],
        [TRAJECTORY_TOKENS.AtomPropertiesService, AtomPropertiesService],
        [TRAJECTORY_TOKENS.ColorCodingService, ColorCodingService],
        [TRAJECTORY_TOKENS.ParticleFilterService, ParticleFilterService],
        [TRAJECTORY_TOKENS.TrajectoryPresenceSocketModule, TrajectoryPresenceSocketModule],
        [TRAJECTORY_TOKENS.CanvasWorkspaceRealtimeStateService, CanvasWorkspaceRealtimeStateService],
        [TRAJECTORY_TOKENS.CanvasWorkspaceSocketModule, CanvasWorkspaceSocketModule],
        [TRAJECTORY_TOKENS.TrajectoryCloneJobRepository, TrajectoryCloneJobRepository],
        [TRAJECTORY_TOKENS.TrajectoryCloneCoordinator, TrajectoryCloneCoordinator],
        [TRAJECTORY_TOKENS.TrajectoryCloneRunner, TrajectoryCloneRunner],
        GetColorCodingPropertiesUseCase,
        GetColorCodingStatsUseCase,
        CreateTrajectoryFolderUseCase,
        CreateColoredModelUseCase,
        DeleteTrajectoryFolderUseCase,
        GetColoredModelStreamUseCase,
        GetParticleFilterPropertiesUseCase,
        GetTrajectoryFolderUseCase,
        PreviewParticleFilterUseCase,
        ApplyParticleFilterActionUseCase,
        GetFilteredModelStreamUseCase,
        GetParticleFilterUniqueValuesUseCase,
        ListTrajectoryFoldersUseCase,
        ListTrajectorySceneArtifactsUseCase,
        TrajectoryReadAccessService,
        GetPublicCanvasBootstrapUseCase,
        GetPublicCanvasDumpUseCase,
        GetPublicCanvasGLBUseCase,
        GetPublicCanvasPreviewUseCase,
        GetPublicCanvasRasterFrameUseCase,
        GetPublicCanvasTrajectoryUseCase,
        ListPublicCanvasAnalysesUseCase,
        GetPublicCanvasAtomsUseCase,
        GetPublicCanvasSimulationCellUseCase,
        ListPublicCanvasSceneArtifactsUseCase,
        GetPublicCanvasColorCodingPropertiesUseCase,
        GetPublicCanvasColorCodingStatsUseCase,
        GetPublicCanvasColoredModelStreamUseCase,
        GetPublicCanvasParticleFilterPropertiesUseCase,
        GetPublicCanvasParticleFilterUniqueValuesUseCase,
        GetPublicCanvasParticleFilterPreviewUseCase,
        GetPublicCanvasFilteredModelStreamUseCase,
        GetPublicCanvasPluginUseCase,
        GetPublicCanvasPluginListingUseCase,
        GetPublicCanvasSubListingUseCase,
        GetPublicCanvasPluginExposureGLBUseCase,
        GetPublicCanvasAnalysisFrameLogUseCase,
        GetPublicCanvasRasterMetadataUseCase,
        CloneTrajectoryUseCase,
        MoveTrajectoryUseCase,
        GetTeamMetricsUseCase,
        UpdateTrajectoryFolderUseCase,
        JobStatusChangedEventHandler
    ],
    bindings: [
        ...createClassBindings(AI_TOKENS.AITool, trajectoryAiTools)
    ],
    aliases: [
        [SOCKET_TOKENS.SocketModule, TRAJECTORY_TOKENS.TrajectoryPresenceSocketModule],
        [SOCKET_TOKENS.SocketModule, TRAJECTORY_TOKENS.CanvasWorkspaceSocketModule]
    ]
};
