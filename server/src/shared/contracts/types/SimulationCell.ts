export type { SimulationCellDims, SimulationCellPeriodicBoundaryConditions, SimulationCellGeometry } from '@volt/contracts/modules/simulation-cell/domain';
import type { SimulationCellDims, SimulationCellPeriodicBoundaryConditions, SimulationCellGeometry } from '@volt/contracts/modules/simulation-cell/domain';

export interface SimulationCellTrajectoryReference {
    _id?: string;
    name?: string;
}

export interface SimulationCellProps {
    boundingBox: SimulationCellDims;
    geometry: SimulationCellGeometry;
    team: string;
    trajectory: string | SimulationCellTrajectoryReference;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface SimulationCellLike {
    readonly _id: string;
    props: SimulationCellProps;
}
