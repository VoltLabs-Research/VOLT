// Wire response types for the simulation-cell module — the shapes the client
// reads back from `data`. `_id`, refs and dates are strings on the wire.

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

/** A simulation cell as the client sees it (trajectory ref may be populated). */
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

/** `getByTrajectory` resolves to the matching cell or `null` when none exists. */
export type GetSimulationCellByTrajectoryResponse = PersistedSimulationCell | null;
