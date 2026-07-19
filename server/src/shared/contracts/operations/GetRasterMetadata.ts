
import type { RasterMetadata } from '@shared/contracts/types/RasterMetadata';

export interface GetRasterMetadataInput {
    trajectoryId: string;
    teamId: string;
}

export interface GetRasterMetadataOutput {
    metadata: RasterMetadata | null;
}
