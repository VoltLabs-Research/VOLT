/**
 * Neutral, standalone STRUCTURAL contract for trajectory data.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). These are
 * STANDALONE copies of the shapes owned by
 * `@modules/trajectory/entities/trajectory/Trajectory`, exported here so
 * cross-module consumers (cluster / plugin / analysis / raster / dashboard /
 * jobs) can depend on the shapes without importing the trajectory module. Field
 * shapes match the owner exactly; the `TrajectoryStatus` enum is duplicated as a
 * runtime value because consumers use it as a value, not just a type.
 *
 * The Trajectory entity in the owner module is a class with methods — it is NOT
 * copied here. Consumers needing the entity type can use the structural
 * `TrajectoryLike` shape below.
 *
 * No `@modules/*` imports — pure data/types only.
 */

export enum TrajectoryStatus {
    Queued = 'queued',
    WaitingForProcess = 'waiting-for-process',
    Processing = 'processing',
    Completed = 'completed',
    Failed = 'failed'
}

export interface TrajectoryFrameSimulationCellEmbed {
    _id: string;
    boundingBox: { width: number; height: number; length: number };
    geometry: {
        cell_vectors: number[][];
        cell_origin: number[];
        periodic_boundary_conditions: { x: boolean; y: boolean; z: boolean };
    };
    team?: string;
    trajectory?: string;
    timestep: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell?: string | TrajectoryFrameSimulationCellEmbed;
}

export interface TrajectoryStats {
    totalFiles: number;
    totalSize: number;
}

export interface TrajectoryProps {
    name: string;
    team: string;
    folder: string | null;
    storageClusterId?: string;
    createdBy: string;
    status: TrajectoryStatus;
    isPublic: boolean;
    frames?: TrajectoryFrame[];
    framesCount?: number;
    atoms?: number;
    firstTimestep?: number;
    analysis?: string[];
    rasterSceneViews: number;
    hasPreview?: boolean;
    stats: TrajectoryStats;
    updatedAt: Date;
    createdAt: Date;
}

/**
 * Structural stand-in for the Trajectory entity (a class with methods in the
 * owner module). Consumers that only need the data shape can use this instead of
 * importing the concrete class.
 */
export interface TrajectoryLike {
    _id: string;
    props: TrajectoryProps;
}
