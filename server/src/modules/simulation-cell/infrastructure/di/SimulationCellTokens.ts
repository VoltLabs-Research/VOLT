/**
 * Re-export shim (detachable-modules migration). The neutral, cross-module
 * token symbols now live at `@shared/contracts/tokens/SimulationCellTokens`
 * (`SIMULATION_CELL_CONTRACT_TOKENS`, same `Symbol.for(...)` keys). This owner
 * file re-exports them as `SIMULATION_CELL_TOKENS` so existing importers compile
 * unchanged and DI registration/resolution stays byte-identical.
 */
export { SIMULATION_CELL_CONTRACT_TOKENS as SIMULATION_CELL_TOKENS } from '@shared/contracts/tokens/SimulationCellTokens';
