export enum TrajectoryStatus {
    Queued = 'queued',
    WaitingForProcess = 'waiting-for-process',
    Processing = 'processing',
    Completed = 'completed',
    Analyzing = 'analyzing',
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
    // Why: accepts either the raw ObjectId string (write path) or the fully
    // populated simulation-cell payload (read path — what HTTP consumers need
    // to render box bounds client-side). The repository maps accordingly.
    simulationCell: string | TrajectoryFrameSimulationCellEmbed;
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
    /**
     * Frames are persisted in the dedicated `trajectoryframes` collection
     * (TrajectoryFrameRepository). They are not hydrated on the parent
     * Trajectory entity by default — callers must fetch them explicitly.
     * Kept on the props only as a transient shape for use cases that still
     * pass the list around (clone source snapshot, daemon dispatch payload).
     */
    frames?: TrajectoryFrame[];
    // Transient summary fields populated by listing use cases that cannot
    // afford to hydrate the full `frames[]` payload per row (20 rows × N
    // frames would re-introduce the 1 MB responses the F2.S6 refactor avoided).
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

export default class Trajectory {
    constructor(
        public readonly _id: string,
        public props: TrajectoryProps
    ) {}

    get id(): string {
        return this._id;
    }
}
