/**
 * Neutral, cross-module DI token symbols for the COMPUTE MESH
 * (trajectory / analysis / plugin / raster / cluster / container).
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * symbols are injected by more than one module, so hosting them here lets a
 * consumer inject without importing the owner module's `*Tokens.ts`. Keys are
 * the SAME `Symbol.for(...)` strings used by the owner modules, so registration
 * and resolution are byte-identical at runtime. Owner token files should
 * reference these (e.g. `AnalysisRepository: COMPUTE_TOKENS.AnalysisRepository`)
 * so there is a single source of truth.
 */
export const COMPUTE_TOKENS = Object.freeze({
    AnalysisRepository: Symbol.for('AnalysisRepository'),
    AnalysisExecutionLogService: Symbol.for('AnalysisExecutionLogService'),
    GetAnalysisFrameLogUseCase: Symbol.for('GetAnalysisFrameLogUseCase'),
    TrajectoryRepository: Symbol.for('TrajectoryRepository'),
    TrajectoryFrameRepository: Symbol.for('TrajectoryFrameRepository'),
    SceneArtifactRepository: Symbol.for('SceneArtifactRepository'),
    TeamJobMaintenanceService: Symbol.for('TeamJobMaintenanceService'),
    PluginRepository: Symbol.for('PluginRepository'),
    StoragePlacementService: Symbol.for('StoragePlacementService')
});
