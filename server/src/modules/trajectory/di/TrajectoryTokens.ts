import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { TRAJECTORY_CONTRACT_TOKENS } from '@shared/contracts/tokens/TrajectoryTokens';

export const TRAJECTORY_TOKENS = Object.freeze({
    TrajectoryService: Symbol.for('TrajectoryService'),
    TrajectoryRepository: COMPUTE_TOKENS.TrajectoryRepository,
    TrajectoryFrameRepository: COMPUTE_TOKENS.TrajectoryFrameRepository,
    TrajectoryCloneJobRepository: Symbol.for('TrajectoryCloneJobRepository'),
    SceneArtifactRepository: COMPUTE_TOKENS.SceneArtifactRepository,
    TrajectoryReader: Symbol.for('TrajectoryReader'),
    TrajectoryDumpStorageService: TRAJECTORY_CONTRACT_TOKENS.TrajectoryDumpStorageService,
    TeamMetricsQueryService: TRAJECTORY_CONTRACT_TOKENS.TeamMetricsQueryService,
    ColorCodingService: Symbol.for('ColorCodingService'),
    ParticleFilterService: Symbol.for('ParticleFilterService'),
    LineStyleService: Symbol.for('LineStyleService'),
    TrajectoryCloneRunner: Symbol.for('TrajectoryCloneRunner'),
    AtomPropertiesService: Symbol.for('AtomPropertiesService'),
    TrajectoryNativeDaemonService: Symbol.for('TrajectoryNativeDaemonService'),
    CanvasWorkspaceRealtimeStateService: Symbol.for('CanvasWorkspaceRealtimeStateService')
});
