export interface SimulationCellDims {
    width: number;
    height: number;
    length: number;
};

export interface SimulationCellGeometry {
    cell_vectors: number[][];
    cell_origin: number[];
    periodic_boundary_conditions: {
        x: boolean;
        y: boolean;
        z: boolean;
    };
};

import { TrajectoryProps } from '@/src/modules/trajectory/domain/entities/Trajectory';
export interface SimulationCellProps {
    boundingBox: SimulationCellDims;
    geometry: SimulationCellGeometry;
    team: string;
    trajectory: string | TrajectoryProps;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
};

export default class SimulationCell {
    constructor(
        public id: string,
        public props: SimulationCellProps
    ) { }
};
