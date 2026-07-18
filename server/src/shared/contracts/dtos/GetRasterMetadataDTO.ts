
import type { RasterMetadata } from '@shared/contracts/types/RasterMetadata';

export interface GetRasterMetadataInputDTO {
    trajectoryId: string;
    teamId: string;
}

export interface GetRasterMetadataOutputDTO {
    metadata: RasterMetadata | null;
}
