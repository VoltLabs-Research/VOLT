/**
 * Neutral, standalone STRUCTURAL contract for simulation-cell data.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). These are
 * the data shapes owned by
 * `@modules/simulation-cell/domain/entities/SimulationCell`, hosted here so
 * cross-module consumers (currently `@modules/trajectory`) can depend on the
 * shapes without importing the simulation-cell module. The owner re-exports
 * every name below so its existing importers compile unchanged.
 *
 * The owner's `SimulationCell` is a plain `{ _id, props }` interface plus a
 * `createSimulationCell` factory (runtime). The factory stays in the owner; the
 * structural entity shape is exposed here as `SimulationCellLike`.
 *
 * No `@modules/*` imports — pure data/types only.
 */

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

/**
 * Structural stand-in for the SimulationCell entity (a plain `{ _id, props }`
 * interface in the owner module). Consumers that only need the data shape can
 * use this instead of importing the owner's entity declaration.
 */
export interface SimulationCellLike {
    readonly _id: string;
    props: SimulationCellProps;
}
