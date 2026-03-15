export interface RasterFrameMetadata {
    timestep: number;
    availableModels: string[];
};

export interface RasterTrajectoryMetadata {
    availableTimesteps: number[];
};

export interface RasterAnalysisMetadata {
    analysisId: string;
    totalFrames: number;
    rasterizedFrames: number;
    availableTimesteps: number[];
    frames: RasterFrameMetadata[];
};

export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: RasterMetadataStatus;
    trajectory: RasterTrajectoryMetadata | null;
    analyses: RasterAnalysisMetadata[];
    createdAt: Date;
    updatedAt: Date;
};

export enum RasterMetadataStatus {
    Pending = 'pending',
    Processing = 'processing',
    Completed = 'completed',
    Failed = 'failed'
};
