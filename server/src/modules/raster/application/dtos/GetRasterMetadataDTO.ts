import type { RasterMetadata } from '@modules/raster/domain/entities/RasterMetadata';

export interface GetRasterMetadataInputDTO {
    trajectoryId: string;
};

export interface GetRasterMetadataOutputDTO {
    metadata: RasterMetadata | null;
};
