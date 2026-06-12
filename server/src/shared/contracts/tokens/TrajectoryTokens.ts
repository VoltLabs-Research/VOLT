/**
 * Neutral, cross-module DI token symbols for the TRAJECTORY domain.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * symbols are injected by more than one module, so hosting them here lets a
 * consumer inject without importing the owner module's `TrajectoryTokens.ts`.
 * Keys are the SAME `Symbol.for(...)` strings used by the owner module, so
 * registration and resolution are byte-identical at runtime.
 *
 * Note: `TrajectoryFrameRepository` is also present in `COMPUTE_TOKENS`; the
 * `Symbol.for('TrajectoryFrameRepository')` global-registry key makes both
 * references resolve to the identical symbol, so either may be used.
 */
export const TRAJECTORY_CONTRACT_TOKENS = Object.freeze({
    TrajectoryFrameRepository: Symbol.for('TrajectoryFrameRepository'),
    TrajectoryDumpStorageService: Symbol.for('TrajectoryDumpStorageService'),
    TeamMetricsQueryService: Symbol.for('TeamMetricsQueryService')
});
