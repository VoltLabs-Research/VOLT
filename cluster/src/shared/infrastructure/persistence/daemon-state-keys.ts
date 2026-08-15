export const toParquetDrainClaimKey = (trajectoryId: string): string =>
    `trajectory:${trajectoryId}:parquet-drain`;

export const toAutoPreviewRasterClaimKey = (trajectoryId: string): string =>
    `trajectory:${trajectoryId}:auto-preview-raster`;
