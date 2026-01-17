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

export interface TrajectoryProcessingProgress {
    stage: 'parsing' | 'processing' | 'uploading' | 'rasterizing' | 'completed' | 'failed';
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message?: string;
};

export interface TrajectoryStats {
    totalFiles: number;
    totalSize: number;
    processedFrames?: number;
    uploadedFrames?: number;
};

export interface TrajectoryProps {
    name: string;
    team: any;
    createdBy: any;
    status: TrajectoryStatus,
    isPublic: boolean;
    analysis: any[];
    frames: TrajectoryFrame[];
    rasterSceneViews: number;
    stats: TrajectoryStats;
    processingProgress?: TrajectoryProcessingProgress;
    updatedAt: Date;
    createdAt: Date;
};

export default class Trajectory {
    constructor(
        public id: string,
        public props: TrajectoryProps
    ) { }

    updateStatus(status: TrajectoryStatus | string): void {
        this.props.status = status as TrajectoryStatus;
        this.props.updatedAt = new Date();
    }
};