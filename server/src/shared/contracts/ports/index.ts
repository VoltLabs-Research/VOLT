/**
 * Barrel for neutral cross-module port (interface) contracts.
 *
 * Populated incrementally by the detachable-modules migration.
 */
export type { IAnalysisRepository, AnalysisRuntimeTarget, AnalysisTeamSearchOptions } from './IAnalysisRepository';
export type { ITrajectoryRepository } from './ITrajectoryRepository';
export type { ISceneArtifactRepository, TeamSceneArtifactFilters } from './ISceneArtifactRepository';
export type { ITeamClusterObjectGatewayClient } from './ITeamClusterObjectGatewayClient';
export type { ITeamClusterSelectionService } from './ITeamClusterSelectionService';
export type { ITeamClusterExposureRegistryService } from './ITeamClusterExposureRegistryService';
export type {
    IClusterObjectArchiveService,
    ClusterArchiveObjectEntry,
    ClusterArchiveInlineEntry,
    ClusterArchiveEntry,
    ClusterArchiveReference,
    ClusterArchiveDownload,
    CreateArchiveDownloadInput
} from './IClusterObjectArchiveService';
export type { IClusterObjectSignedUrlService } from './IClusterObjectSignedUrlService';
export type { IMemberContentCounter, MemberContentCountResult } from './IMemberContentCounter';
export type { ITrajectoryFrameRepository, GetFramesOptions, TrajectoryFrameListingSummary } from './ITrajectoryFrameRepository';
export type { IStoragePlacementService } from './IStoragePlacementService';
export type { ITeamClusterRepository, TeamClusterLifecycleUpdatePreconditions } from './ITeamClusterRepository';
export type {
    IDaemonAnalysisCompletionService,
    DaemonJobCompletionInput,
    DaemonAnalysisJobStatusInput,
    DaemonAnalysisStageStatusInput,
    DaemonRasterJobStatusInput,
    DaemonGlbJobStatusInput,
    DaemonArtifactUploadJobStatusInput,
    QueuedJobNotification,
    QueuedDaemonJobNotification
} from './IDaemonAnalysisCompletionService';
export type {
    ITeamJobMaintenanceService,
    TeamClusterFailureDetail,
    RemoveTeamJobsResult,
    RetryTeamJobsResult,
    TrajectoryDeletedCleanupInput,
    AnalysisDeletedCleanupInput
} from './ITeamJobMaintenanceService';
export type { IPluginRepository } from './IPluginRepository';
export type { IContainerRepository } from './IContainerRepository';
export type {
    ContainerEnvironmentVariable,
    ContainerPortMapping,
    CreateRuntimeContainerOptions,
    ContainerProcessInfo,
    ContainerStats,
    RuntimeContainerInfo,
    ContainerFileEntry,
    ContainerTerminalSize,
    ContainerTerminalStream,
    ContainerTerminalExec,
    ContainerTerminalAttachment
} from './IContainerService';
export type { IChatRepository, PersistedChatDTO } from './IChatRepository';
export type { IDeploymentSettingsRepository, DeploymentSettingsView } from './IDeploymentSettingsRepository';
export type { IStoragePlacementRepository } from './IStoragePlacementRepository';
export type { IClusterTransferJobRepository } from './IClusterTransferJobRepository';
export type {
    IContainerDeploymentProgressService,
    ContainerDeploymentProgressInput
} from './IContainerDeploymentProgressService';
export type { IPluginDebugSessionRegistryService } from './IPluginDebugSessionRegistryService';
export type { ITeamMetricsQueryService, TeamMetricsSnapshot } from './ITeamMetricsQueryService';
export type { IRasterStorageService } from './IRasterStorageService';
export type { IGetRasterMetadataUseCase } from './IGetRasterMetadataUseCase';
export type { ISimulationCellRepository } from './ISimulationCellRepository';
export type { IGetSimulationCellByTrajectoryUseCase } from './IGetSimulationCellByTrajectoryUseCase';
export type { IGetPluginByIdUseCase } from './IGetPluginByIdUseCase';
export type { IGetPluginExposureGLBUseCase } from './IGetPluginExposureGLBUseCase';
export type { IGetPluginExposureExportUseCase } from './IGetPluginExposureExportUseCase';
export type { IGetPluginListingDocumentsUseCase } from './IGetPluginListingDocumentsUseCase';
export type { IGetSubListingUseCase } from './IGetSubListingUseCase';
export type { IGetAnalysisFrameLogUseCase } from './IGetAnalysisFrameLogUseCase';
