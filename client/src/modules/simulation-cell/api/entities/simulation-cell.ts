import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

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

export interface SimulationCellTrajectory {
    _id: string;
    name: string;
};

export interface SimulationCell extends BaseEntity {
    boundingBox: SimulationCellDims;
    geometry: SimulationCellGeometry;
    team: string;
    trajectory: SimulationCellTrajectory;
    timestep: number;
};
