export const TRAJECTORY_TOKENS = {
    TrajectoryRepository: Symbol.for('TrajectoryRepository'),
    TrajectoryDumpStorageService: Symbol.for('TrajectoryDumpStorageService'),
    AtomisticExporter: Symbol.for('AtomisticExporter'),
    DislocationExporter: Symbol.for('DislocationExporter'),
    MeshExporter: Symbol.for('MeshExporter'),
    ChartExporter: Symbol.for('ChartExporter'),
    TrajectoryProcessingQueue: Symbol.for('TrajectoryProcessingQueue'),
    TrajectoryBackgroundProcessor: Symbol.for('TrajectoryBackgroundProcessor'),
    CloudUploadQueue: Symbol.for('CloudUploadQueue'),
    AtomPropertiesService: Symbol.for('AtomPropertiesService'),
    ColorCodingService: Symbol.for('ColorCodingService'),
    ParticleFilterService: Symbol.for('ParticleFilterService'),
};