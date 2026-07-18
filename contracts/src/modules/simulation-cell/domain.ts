

export interface SimulationCellDims{
    width: number;
    height: number;
    length: number;
}

export interface SimulationCellPeriodicBoundaryConditions{
    x: boolean;
    y: boolean;
    z: boolean;
}

export interface SimulationCellGeometry{
    cell_vectors: number[][];
    cell_origin: number[];
    periodic_boundary_conditions: SimulationCellPeriodicBoundaryConditions;
}

export interface SimulationCellTrajectoryReference{
    _id?: string;
    name?: string;
}

export interface PersistedSimulationCell{
    _id: string;
    boundingBox: SimulationCellDims;
    geometry: SimulationCellGeometry;
    team: string;
    trajectory: string | SimulationCellTrajectoryReference;
    timestep: number;
    createdAt?: string;
    updatedAt?: string;
}

export type GetSimulationCellResponse = PersistedSimulationCell;

export type GetSimulationCellByTrajectoryResponse = PersistedSimulationCell | null;
