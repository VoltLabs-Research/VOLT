/**
 * Neutral, cross-module DI token symbols for the SIMULATION-CELL domain.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * symbols are injected by more than one module (the owner plus
 * `@modules/trajectory`), so hosting them here lets a consumer inject without
 * importing the owner module's `SimulationCellTokens.ts`. Keys are the SAME
 * `Symbol.for(...)` strings used by the owner module, so registration and
 * resolution are byte-identical at runtime.
 */
export const SIMULATION_CELL_CONTRACT_TOKENS = Object.freeze({
    SimulationCellRepository: Symbol.for('SimulationCellRepository'),
    GetSimulationCellByTrajectoryUseCase: Symbol.for('GetSimulationCellByTrajectoryUseCase')
});
