import { RasterMetadataStatus } from '@volt/contracts/modules/raster/domain';
import { assertSameFields } from '@shared/contracts/assert-wire-match';
import type {
    RasterTrajectoryMetadata,
    RasterAnalysisMetadata,
    RasterMetadata as WireRasterMetadata
} from '@volt/contracts/modules/raster/domain';

export interface RasterMetadata {
    trajectoryId: string;
    totalFrames: number;
    rasterizedFrames: number;
    status: RasterMetadataStatus;
    trajectory: RasterTrajectoryMetadata | null;
    analyses: RasterAnalysisMetadata[];
    createdAt: Date;
    updatedAt: Date;
}

assertSameFields<RasterMetadata, WireRasterMetadata>();
