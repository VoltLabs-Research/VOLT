/**
 * Keys used in the daemon state store, in one place.
 *
 * These are read by the code that claims them and again by the cleanup that runs when
 * a trajectory is deleted, so a key spelled out at both ends eventually drifts at one
 * of them and leaves rows behind that nothing ever collects.
 */

/** Held by the frame that is building a trajectory's parquet, so only one does. */
export const toParquetDrainClaimKey = (trajectoryId: string): string =>
    `trajectory:${trajectoryId}:parquet-drain`;

/** Held by the frame that queued the trajectory's automatic preview rasterization. */
export const toAutoPreviewRasterClaimKey = (trajectoryId: string): string =>
    `trajectory:${trajectoryId}:auto-preview-raster`;
