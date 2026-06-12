/**
 * Re-export shim (detachable-modules migration). The structural simulation-cell
 * data shapes now live in the neutral contracts layer
 * (`@shared/contracts/types/SimulationCell`). This owner file re-exports them so
 * existing `@modules/simulation-cell/domain/entities/SimulationCell` importers
 * compile unchanged, and retains the runtime `createSimulationCell` factory plus
 * the `SimulationCell` entity alias.
 */
export type {
    SimulationCellDims,
    SimulationCellPeriodicBoundaryConditions,
    SimulationCellGeometry,
    SimulationCellTrajectoryReference,
    SimulationCellProps,
    SimulationCellLike
} from '@shared/contracts/types/SimulationCell';

import type { SimulationCellLike, SimulationCellProps } from '@shared/contracts/types/SimulationCell';

export interface SimulationCell extends SimulationCellLike {}

export const createSimulationCell = (_id: string, props: SimulationCellProps): SimulationCell => ({
    _id,
    props
});

export default SimulationCell;
