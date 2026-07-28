import { RasterMetadataStatus } from '@volt/contracts/modules/raster/domain';
import type {
    RasterFrameMetadata,
    RasterTrajectoryMetadata,
    RasterAnalysisMetadata
} from '@volt/contracts/modules/raster/domain';

export { RasterMetadataStatus };
export type { RasterFrameMetadata, RasterTrajectoryMetadata, RasterAnalysisMetadata };

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
