import type { Trajectory } from '@/modules/trajectory/domain/entities';

export interface BoundingBox {
    width: number;
    height: number;
    length: number;
}

export interface PeriodicBoundaryConditions {
    x: boolean;
    y: boolean;
    z: boolean;
}

export interface Geometry {
    periodic_boundary_conditions: PeriodicBoundaryConditions;
}

export interface SimulationCell {
    _id: string;
    trajectory: Trajectory;
    timestep: number;
    boundingBox: BoundingBox;
    geometry: Geometry;
    createdAt: string;
    updatedAt: string;
}
