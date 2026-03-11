export enum TrajectoryStatus {
    Queued = 'queued',
    WaitingForProcess = 'waiting-for-process',
    Processing = 'processing',
    Rendering = 'rendering',
    Completed = 'completed',
    Analyzing = 'analyzing',
    Failed = 'failed'
};

export interface TrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

export interface TrajectoryStats {
    totalFiles: number;
    totalSize: number;
};

export interface TrajectoryProps {
    name: string;
    team: any;
    folder: string | null;
    teamCluster?: string;
    createdBy: any;
    status: TrajectoryStatus,
    isPublic: boolean;
    frames: TrajectoryFrame[];
    analysis?: string[];
    rasterSceneViews: number;
    stats: TrajectoryStats;
    updatedAt: Date;
    createdAt: Date;
};

export default class Trajectory {
    constructor(
        public readonly _id: string,
        public props: TrajectoryProps
    ){}

    get id(): string {
        return this._id;
    }

    updateStatus(status: TrajectoryStatus | string): void {
        this.props.status = status as TrajectoryStatus;
        this.props.updatedAt = new Date();
    }
};
