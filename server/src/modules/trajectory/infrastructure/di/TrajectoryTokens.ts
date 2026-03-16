export const TRAJECTORY_TOKENS = {
    TrajectoryRepository: Symbol.for('TrajectoryRepository'),
    TrajectoryFolderRepository: Symbol.for('TrajectoryFolderRepository'),
    TeamMetricsQueryService: Symbol.for('TeamMetricsQueryService'),
    SceneArtifactRepository: Symbol.for('SceneArtifactRepository'),
    TrajectoryReader: Symbol.for('TrajectoryReader'),
    TrajectoryDumpStorageService: Symbol.for('TrajectoryDumpStorageService'),
    TrajectoryBackgroundProcessor: Symbol.for('TrajectoryBackgroundProcessor'),
    CloudUploadProcessor: Symbol.for('CloudUploadProcessor'),
    TrajectoryNativeDaemonService: Symbol.for('TrajectoryNativeDaemonService'),
    AtomPropertiesService: Symbol.for('AtomPropertiesService'),
    ColorCodingService: Symbol.for('ColorCodingService'),
    ParticleFilterService: Symbol.for('ParticleFilterService'),
    CloudUploadQueueService: Symbol.for('CloudUploadQueueService'),
    TrajectoryPresenceSocketModule: Symbol.for('TrajectoryPresenceSocketModule')
} as const;
