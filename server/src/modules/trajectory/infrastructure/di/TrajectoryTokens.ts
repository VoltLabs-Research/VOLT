export const TRAJECTORY_TOKENS = {
    TrajectoryRepository: Symbol.for('TrajectoryRepository'),
    TeamMetricsQueryService: Symbol.for('TeamMetricsQueryService'),
    SceneArtifactRepository: Symbol.for('SceneArtifactRepository'),
    TrajectoryReader: Symbol.for('TrajectoryReader'),
    TrajectoryDumpStorageService: Symbol.for('TrajectoryDumpStorageService'),
    AtomisticExporter: Symbol.for('AtomisticExporter'),
    DislocationExporter: Symbol.for('DislocationExporter'),
    MeshExporter: Symbol.for('MeshExporter'),
    ChartExporter: Symbol.for('ChartExporter'),
    TrajectoryBackgroundProcessor: Symbol.for('TrajectoryBackgroundProcessor'),
    CloudUploadProcessor: Symbol.for('CloudUploadProcessor'),
    TrajectoryNativeDaemonService: Symbol.for('TrajectoryNativeDaemonService'),
    AtomPropertiesService: Symbol.for('AtomPropertiesService'),
    ColorCodingService: Symbol.for('ColorCodingService'),
    ParticleFilterService: Symbol.for('ParticleFilterService')
} as const;
