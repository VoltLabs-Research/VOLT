

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

export interface TrajectoryLike {
    _id: string;
    props: TrajectoryProps;
}
