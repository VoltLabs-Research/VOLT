import type { RasterMetadata } from '@shared/contracts/types/RasterMetadata';

export interface IRasterMetadataService {
    getRasterMetadata(trajectoryId: string, teamId: string): Promise<RasterMetadata | null>;
}
