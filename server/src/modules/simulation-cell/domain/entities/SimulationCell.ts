export interface SimulationCellDims {
    width: number;
    height: number;
    length: number;
}

export interface SimulationCellPeriodicBoundaryConditions {
    x: boolean;
    y: boolean;
    z: boolean;
}

export interface SimulationCellGeometry {
    cell_vectors: number[][];
    cell_origin: number[];
    periodic_boundary_conditions: SimulationCellPeriodicBoundaryConditions;
}

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

export interface SimulationCell {
    readonly _id: string;
    props: SimulationCellProps;
}

export const createSimulationCell = (_id: string, props: SimulationCellProps): SimulationCell => ({
    _id,
    props
});

export default SimulationCell;
