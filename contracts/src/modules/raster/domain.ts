// Wire response types for the raster module — the shapes the client reads back
// from `data` (JSON endpoints) plus the binary PNG stream marker. Dates are
// strings on the wire.

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

/**
 * The raster-frame endpoints stream a raw `image/png` body (inline disposition)
 * rather than a JSON envelope — this marker types the binary response the client
 * receives.
 */
export type RasterFramePNGResponse = ArrayBuffer;
