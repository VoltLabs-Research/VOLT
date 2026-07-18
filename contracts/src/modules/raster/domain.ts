

export interface TriggerRasterizationResponse{
    trajectoryId: string;
    triggered: boolean;
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
}

export type RasterMetadataStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface RasterFrameMetadata{
    timestep: number;
    availableModels: string[];
}

export interface RasterTrajectoryMetadata{
    availableTimesteps: number[];
}

export interface RasterAnalysisMetadata{
    analysisId: string;
    totalFrames: number;
    rasterizedFrames: number;
    availableTimesteps: number[];
    frames: RasterFrameMetadata[];
}

export interface RasterMetadata{
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: RasterMetadataStatus;
    trajectory: RasterTrajectoryMetadata | null;
    analyses: RasterAnalysisMetadata[];
    createdAt: string;
    updatedAt: string;
}

export interface GetRasterMetadataResponse{
    metadata: RasterMetadata | null;
}

export type RasterFramePNGResponse = ArrayBuffer;
