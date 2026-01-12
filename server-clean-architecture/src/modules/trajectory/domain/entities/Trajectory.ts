export enum TrajectoryStatus {
    Queued = 'queued',
    WaitingForProcess = 'waiting-for-process',
    Processing = 'processing',
    Rendering = 'completed',
    Analyzing = 'analyzing',
    Failed = 'failed'
};

export interface TrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

export interface TrajectoryStats{
    totalFiles: number;
    totalSize: number;
};

export interface TrajectoryProps {
    name: string;
    team: string;
    createdBy: string;
    status: TrajectoryStatus,
    isPublic: boolean;
    analysis: string[];
    frames: TrajectoryFrame;
    rasterSceneViews: number;
    stats: TrajectoryStats;
    uploadId: string;
    updatedAt: Date;
    createdAt: Date;
};

export default class Trajectory{
    constructor(
        public id: string,
        public props: TrajectoryProps
    ){}
};