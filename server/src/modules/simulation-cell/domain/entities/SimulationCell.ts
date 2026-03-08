export interface SimulationCellDims {
    width: number;
    height: number;
    length: number;
};

export interface SimulationCellPeriodicBoundaryConditions {
    x: boolean;
    y: boolean;
    z: boolean;
};

export interface SimulationCellGeometry {
    cell_vectors: number[][];
    cell_origin: number[];
    periodic_boundary_conditions: SimulationCellPeriodicBoundaryConditions;
};

export interface SimulationCellTrajectoryReference {
    _id?: string;
    name?: string;
};

export interface SimulationCellProps {
    boundingBox: SimulationCellDims;
    geometry: SimulationCellGeometry;
    team: string;
    trajectory: string | SimulationCellTrajectoryReference;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
};

export default class SimulationCell {
    constructor(
        public readonly _id: string,
        public props: SimulationCellProps
    ) {}

    get id(): string {
        return this._id;
    }
};
