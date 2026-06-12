/**
 * Canonical, neutral repository-port contract for the SimulationCell domain.
 * Extracted from
 * `@modules/simulation-cell/domain/port/ISimulationCellRepository` during the
 * detachable-modules migration. The original owner file re-exports it so
 * existing importers compile unchanged.
 *
 * Fully neutral: the owner's `SimulationCell` entity is a plain `{ _id, props }`
 * interface (no methods), so it is represented here by the structural
 * `SimulationCellLike` shape and the neutral `SimulationCellProps`, both from
 * `@shared/contracts/types/SimulationCell`. No `@modules/*` imports remain.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type { SimulationCellLike, SimulationCellProps } from '@shared/contracts/types/SimulationCell';

export interface ISimulationCellRepository extends IBaseRepository<SimulationCellLike, SimulationCellProps> {
    createMany(items: Array<Partial<SimulationCellProps>>): Promise<SimulationCellLike[]>;
}
