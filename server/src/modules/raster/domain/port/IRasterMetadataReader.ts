import type { RasterMetadata } from '@modules/raster/domain/entities/RasterMetadata';

export interface IRasterMetadataReader {
    getRasterMetadata(trajectoryId: string): Promise<RasterMetadata | null>;
};
