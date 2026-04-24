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

export enum RasterMetadataStatus {
    Pending = 'pending',
    Processing = 'processing',
    Completed = 'completed',
    Failed = 'failed'
};

export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: RasterMetadataStatus;
    trajectory: RasterTrajectoryMetadata | null;
    analyses: RasterAnalysisMetadata[];
    createdAt: string;
    updatedAt: string;
};

export enum RasterFrameScope {
    Trajectory = 'trajectory',
    Analysis = 'analysis'
};

export interface RasterSceneFrame {
    frame: number;
    model: string | null;
    analysisId: string | null;
    scope: RasterFrameScope;
    imageUrl: string | null;
};
