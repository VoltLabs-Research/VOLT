import type { RasterMetadata } from '@modules/raster/domain/entities/RasterMetadata';

export interface GetRasterMetadataInputDTO {
    trajectoryId: string;
    teamId: string;
}

export interface GetRasterMetadataOutputDTO {
    metadata: RasterMetadata | null;
}
