import type { RasterMetadata } from '../entities/raster';

export interface GetRasterMetadataParams {
    trajectoryId: string;
};

export interface GetRasterMetadataResponse {
    metadata: RasterMetadata | null;
};
