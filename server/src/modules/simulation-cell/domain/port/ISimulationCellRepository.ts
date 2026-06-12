/**
 * Re-export shim (detachable-modules migration). The canonical, neutral
 * `ISimulationCellRepository` now lives at
 * `@shared/contracts/ports/ISimulationCellRepository`. This owner file
 * re-exports it so existing
 * `@modules/simulation-cell/domain/port/ISimulationCellRepository` importers
 * compile unchanged.
 */
export type { ISimulationCellRepository } from '@shared/contracts/ports/ISimulationCellRepository';
