/**
 * Neutral, cross-module raster-metadata types.
 *
 * Extracted from `@modules/raster/domain/entities/RasterMetadata` during the
 * detachable-modules migration: `RasterMetadata` is the payload of the
 * `GetRasterMetadataOutputDTO` that the trajectory module consumes (via the
 * public-canvas raster-metadata use case). These are plain structural types
 * (no entity class), so hosting them here introduces no `@modules/*` coupling.
 *
 * `RasterMetadataStatus` is intentionally a runtime VALUE (an `enum`): the
 * raster module compares against it (`=== RasterMetadataStatus.Completed`). It
 * is pure data, so — like the neutral `JobStatus` enum — hosting the
 * `export enum` here is allowed. The owner entity file re-exports all of these
 * so existing importers compile and behave unchanged.
 */
export interface RasterFrameMetadata {
    timestep: number;
    availableModels: string[];
}

export interface RasterTrajectoryMetadata {
    availableTimesteps: number[];
}

export interface RasterAnalysisMetadata {
    analysisId: string;
    totalFrames: number;
    rasterizedFrames: number;
    availableTimesteps: number[];
    frames: RasterFrameMetadata[];
}

export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: RasterMetadataStatus;
    trajectory: RasterTrajectoryMetadata | null;
    analyses: RasterAnalysisMetadata[];
    createdAt: Date;
    updatedAt: Date;
}

export enum RasterMetadataStatus {
    Pending = 'pending',
    Processing = 'processing',
    Completed = 'completed',
    Failed = 'failed'
}
