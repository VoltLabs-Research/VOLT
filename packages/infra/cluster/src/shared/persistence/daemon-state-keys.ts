export const toParquetDrainClaimKey = (trajectoryId: string): string =>
    `trajectory:${trajectoryId}:parquet-drain`;

export const toAutoPreviewRasterClaimKey = (trajectoryId: string): string =>
    `trajectory:${trajectoryId}:auto-preview-raster`;

// Marks a job the server removed, so work that is already queued or running for it is dropped.
export const REMOVED_JOB_TOMBSTONE_TTL_SECONDS = 86_400;

export const toRemovedJobTombstoneKey = (jobId: string): string =>
    `analysis:removed-job:${jobId}`;
