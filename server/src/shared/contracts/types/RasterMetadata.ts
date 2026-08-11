import { RasterMetadataStatus } from '@volt/contracts/modules/raster/domain';
import { assertSameFields } from '@shared/contracts/assert-wire-match';
import type {
    RasterTrajectoryMetadata,
    RasterAnalysisMetadata,
    RasterMetadata as WireRasterMetadata
} from '@volt/contracts/modules/raster/domain';

/**
 * The persisted shape. Identical to the wire type except that the timestamps are
 * `Date` here and `string` after JSON serialization, which is why it is declared
 * rather than re-exported.
 *
 * `assertSameFields` keeps the field lists tied together, so adding a field to the
 * wire contract without adding it here fails the build.
 */
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
