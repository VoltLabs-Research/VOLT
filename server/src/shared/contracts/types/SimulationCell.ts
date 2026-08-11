export type { SimulationCellDims, SimulationCellGeometry } from '@volt/contracts/modules/simulation-cell/domain';
import type { SimulationCellDims, SimulationCellGeometry } from '@volt/contracts/modules/simulation-cell/domain';

interface SimulationCellTrajectoryReference {
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
