import type { RasterMetadata } from '@modules/raster/domain/port/RasterMetadata';

export interface IRasterMetadataReader {
    getRasterMetadata(trajectoryId: string): Promise<RasterMetadata | null>;
}
